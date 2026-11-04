import 'server-only'

import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import { isString } from 'lodash-es'

const UNSYNCABLE_DIR = new Set(['EACCES', 'EINVAL', 'EISDIR', 'ENOTSUP', 'EPERM'])

const UNSUPPORTED_LINK = new Set(['EPERM', 'ENOTSUP', 'EXDEV', 'ENOSYS'])

const WINDOWS_LOCK_CODES = new Set(['EPERM', 'EACCES', 'EBUSY'])

/** About 1.3 s total, long enough for a reader or a scanner to release the file. */
const WINDOWS_LOCK_DELAYS = [10, 20, 40, 80, 160, 320, 640]

interface RetryOnWindowsLockParams {
  platform?: NodeJS.Platform
  sleep?: (ms: number) => Promise<void>
  codes?: ReadonlySet<string>
  delays?: readonly number[]
}

interface RetrySettings {
  platform: NodeJS.Platform
  sleep: (ms: number) => Promise<void>
  codes: ReadonlySet<string>
  delays: readonly number[]
}

function retrySettings(params: RetryOnWindowsLockParams): RetrySettings {
  return {
    platform: params.platform ?? process.platform,
    sleep: params.sleep ?? delay,
    codes: params.codes ?? WINDOWS_LOCK_CODES,
    delays: params.delays ?? WINDOWS_LOCK_DELAYS,
  }
}

function isLockCode(error: unknown, codes: ReadonlySet<string>): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code

  return isString(code) && codes.has(code)
}

/** True when another process holds the file open. */
export function isFileBusy(error: unknown): boolean {
  return isLockCode(error, WINDOWS_LOCK_CODES)
}

/** Retries a file operation while Windows holds the target open, then rethrows the last error. */
export async function retryOnWindowsLock<T>(
  fn: () => Promise<T>,
  params: RetryOnWindowsLockParams = {},
): Promise<T> {
  const { platform, sleep, codes, delays } = retrySettings(params)

  if (platform !== 'win32') {
    return fn()
  }

  let lastError: unknown

  for (const waitMs of [0, ...delays]) {
    if (waitMs > 0) {
      await sleep(waitMs)
    }

    try {
      return await fn()
    } catch (error) {
      if (!isLockCode(error, codes)) {
        throw error
      }

      lastError = error
    }
  }

  throw lastError
}

/**
 * Renames a temp file onto a cache target, accepting a target another writer already made
 * once the Windows lock retries run out.
 */
export async function renameOrKeepExisting(temp: string, target: string): Promise<void> {
  try {
    await retryOnWindowsLock(() => {
      return fs.rename(temp, target)
    })
  } catch (error) {
    if (!isLockCode(error, WINDOWS_LOCK_CODES)) {
      throw error
    }

    const isPresent = await fs.access(target).then(
      () => {
        return true
      },
      () => {
        return false
      },
    )

    if (!isPresent) {
      throw error
    }
  }

  await fs.unlink(temp).catch(() => {})
}

/** Writes a cache file through a temp name, then renames it over the target. */
export async function writeFileAtomic(filePath: string, data: Buffer | string): Promise<void> {
  const temp = `${filePath}.tmp-${randomUUID()}`

  try {
    await fs.writeFile(temp, data)
    await renameOrKeepExisting(temp, filePath)
  } catch (error) {
    await fs.unlink(temp).catch(() => {})

    throw error
  }
}

function isUnsupported(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code

  return isString(code) && UNSYNCABLE_DIR.has(code)
}

/**
 * Flushes a file, or best-effort flushes a directory on platforms without directory fsync.
 * Files open with write access because Windows needs it for FlushFileBuffers.
 */
async function sync(file: string, isDirectory: boolean): Promise<void> {
  let handle: fs.FileHandle

  const flags = isDirectory ? 'r' : 'r+'

  try {
    handle = await fs.open(file, flags)
  } catch (error) {
    if (isDirectory && isUnsupported(error)) {
      return
    }

    throw error
  }

  try {
    await handle.sync()
  } catch (error) {
    if (!isDirectory || !isUnsupported(error)) {
      throw error
    }
  } finally {
    await handle.close()
  }
}

/** Hard-links the temp file, or copies it exclusively where links are unsupported. */
async function linkExclusive(temp: string, target: string): Promise<void> {
  try {
    await retryOnWindowsLock(() => {
      return fs.link(temp, target)
    })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code

    if (!isString(code) || !UNSUPPORTED_LINK.has(code)) {
      throw error
    }

    await retryOnWindowsLock(() => {
      return fs.copyFile(temp, target, constants.COPYFILE_EXCL)
    })
  }
}

interface CommitFileParams {
  temp: string
  target: string
  isExclusive?: boolean
}

/**
 * Fsyncs a written temp file, then renames it and fsyncs its parent directory.
 * Exclusive mode hard-links, falling back to an exclusive copy, so a target is never replaced.
 */
export async function commitFile(params: CommitFileParams): Promise<void> {
  const { temp, target, isExclusive = false } = params
  const dir = path.dirname(target)

  await sync(temp, false)

  if (isExclusive) {
    try {
      await linkExclusive(temp, target)
    } finally {
      await retryOnWindowsLock(() => {
        return fs.unlink(temp)
      }).catch(() => {})
    }

    await sync(dir, true)

    return
  }

  await retryOnWindowsLock(() => {
    return fs.rename(temp, target)
  })

  await sync(dir, true)
}
