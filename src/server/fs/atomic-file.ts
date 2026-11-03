import 'server-only'

import { constants } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import { isString } from 'lodash-es'

const UNSYNCABLE_DIR = new Set(['EACCES', 'EINVAL', 'EISDIR', 'ENOTSUP', 'EPERM'])

const UNSUPPORTED_LINK = new Set(['EPERM', 'ENOTSUP', 'EXDEV', 'ENOSYS'])

function isUnsupported(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code

  return isString(code) && UNSYNCABLE_DIR.has(code)
}

/** Flushes a file, or best-effort flushes a directory on platforms without directory fsync. */
async function sync(file: string, isDirectory: boolean): Promise<void> {
  let handle: fs.FileHandle

  try {
    handle = await fs.open(file, 'r')
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
    await fs.link(temp, target)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code

    if (!isString(code) || !UNSUPPORTED_LINK.has(code)) {
      throw error
    }

    await fs.copyFile(temp, target, constants.COPYFILE_EXCL)
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
      await fs.unlink(temp).catch(() => {})
    }

    await sync(dir, true)

    return
  }

  await fs.rename(temp, target)
  await sync(dir, true)
}
