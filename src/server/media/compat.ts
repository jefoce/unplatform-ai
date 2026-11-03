import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'

import { FFMPEG_TIMEOUTS } from '@/core/constants'
import type { MediaKind } from '@/core/media/media-types'

import { isOwnedName, removeOwnedFile } from '../fs/json-file'
import { COMPAT_DIR } from '../paths'
import { createLimiter } from '../sync/limiter'
import { withLock } from '../sync/lock'
import { probeMedia, runFfmpeg } from './ffmpeg'

type CompatContentType = 'video/mp4' | 'audio/mp4'

export interface CompatMedia {
  path: string
  contentType: CompatContentType
}

type PlayableKind = Exclude<MediaKind, 'image'>

const MAX_CONVERSIONS = 2
const FAIL_TTL_MS = 10 * 60_000
const UNUSED_TTL_MS = 30 * 86_400_000

/** Format ffmpeg could not convert. Mapped to 415 by the media route. */
export class CompatError extends Error {
  readonly status = 415

  constructor() {
    super('Format not playable')
    this.name = 'CompatError'
  }
}

const limiter = createLimiter('compatQueue', MAX_CONVERSIONS)

/** Webview-safe H.264/AAC copy of a source, built once and reused until it goes stale. */
interface GetCompatMediaParams {
  absPath: string
  kind: PlayableKind
  ref: string
}

export async function getCompatMedia(params: GetCompatMediaParams): Promise<CompatMedia> {
  const { absPath, kind, ref } = params

  const source = await fs.stat(absPath).catch(() => {
    return null
  })

  if (isNil(source) || !source.isFile()) {
    throw new Error(`Compat source missing: ${ref}`)
  }

  const ext = kind === 'video' ? 'mp4' : 'm4a'
  const key = createHash('sha1').update(ref).digest('hex')
  const filePath = path.join(COMPAT_DIR, `${key}.${ext}`)
  const failedPath = `${filePath}.failed`
  const contentType: CompatContentType = kind === 'video' ? 'video/mp4' : 'audio/mp4'

  if (await isFresh(filePath, source.mtimeMs)) {
    await touch(filePath)

    return { path: filePath, contentType }
  }

  await assertNotFailed(failedPath, source.mtimeMs)
  await fs.mkdir(COMPAT_DIR, { recursive: true })

  await withLock(`compat:${key}`, async () => {
    if (await isFresh(filePath, source.mtimeMs)) {
      await touch(filePath)

      return
    }

    await assertNotFailed(failedPath, source.mtimeMs)

    await limiter.run(async () => {
      if (await isFresh(filePath, source.mtimeMs)) {
        return
      }

      await convertOrMarkFailed({ source: absPath, kind, filePath, failedPath, ext })
    })
  })

  return { path: filePath, contentType }
}

/** Deletes files not read for 30 days, plus their failure markers. */
export async function sweepCompatFiles(): Promise<number> {
  const cutoff = Date.now() - UNUSED_TTL_MS

  const entries = await fs.readdir(COMPAT_DIR, { withFileTypes: true }).catch(() => {
    return []
  })

  let removed = 0

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue
    }

    if (!isOwnedName(entry.name)) {
      continue
    }

    const file = path.join(COMPAT_DIR, entry.name)

    const stats = await fs.stat(file).catch(() => {
      return null
    })

    if (!stats || stats.mtimeMs >= cutoff) {
      continue
    }

    const didRemove = await removeCompatFile(file)

    if (didRemove) {
      removed += 1
    }
  }

  return removed
}

/** Removes one compat file without letting a single failure stop the sweep. */
async function removeCompatFile(file: string): Promise<boolean> {
  try {
    await removeOwnedFile(file)

    return true
  } catch (error) {
    console.warn('[unplatform-ai] compat cleanup failed', error)

    return false
  }
}

interface ConvertOrMarkFailedParams {
  source: string
  kind: PlayableKind
  filePath: string
  failedPath: string
  ext: string
}

async function convertOrMarkFailed(params: ConvertOrMarkFailedParams): Promise<void> {
  const { source, kind, filePath, failedPath, ext } = params

  try {
    await convert({ source, kind, filePath, ext })
    await fs.unlink(failedPath).catch(() => {})
  } catch (error) {
    console.error('[unplatform-ai] compat conversion failed', error)
    await fs.writeFile(failedPath, '').catch(() => {})

    throw new CompatError()
  }
}

/** Skips conversion for 10 minutes while a matching failure marker exists. */
async function assertNotFailed(failedPath: string, sourceMtimeMs: number): Promise<void> {
  const failed = await fs.stat(failedPath).catch(() => {
    return null
  })

  if (isNil(failed) || !failed.isFile()) {
    return
  }

  if (Date.now() - failed.mtimeMs >= FAIL_TTL_MS) {
    return
  }

  if (failed.mtimeMs < sourceMtimeMs) {
    return
  }

  throw new CompatError()
}

async function isFresh(filePath: string, sourceMtimeMs: number): Promise<boolean> {
  const stats = await fs.stat(filePath).catch(() => {
    return null
  })

  return !isNil(stats) && stats.isFile() && stats.mtimeMs >= sourceMtimeMs
}

/** Records the last serve so the 30 day sweep keeps hot files. */
function touch(filePath: string): Promise<void> {
  return fs.utimes(filePath, new Date(), new Date()).catch(() => {})
}

interface ConvertParams {
  source: string
  kind: PlayableKind
  filePath: string
  ext: string
}

interface ConvertArgsParams {
  kind: PlayableKind
  source: string
  temp: string
}

function convertArgs(params: ConvertArgsParams): string[] {
  const { kind, source, temp } = params

  if (kind === 'video') {
    return [
      '-i',
      source,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      '-y',
      temp,
    ]
  }

  return ['-i', source, '-vn', '-c:a', 'aac', '-y', temp]
}

async function convert(params: ConvertParams): Promise<void> {
  const { source, kind, filePath, ext } = params

  const temp = path.join(
    COMPAT_DIR,
    `${path.basename(filePath, `.${ext}`)}.${randomUUID()}.tmp.${ext}`,
  )

  const args = convertArgs({ kind, source, temp })
  const probe = await probeMedia(source)

  const timeoutMs = Math.min(
    FFMPEG_TIMEOUTS.compatBase + FFMPEG_TIMEOUTS.compatPerSec * (probe.durationSec ?? 0),
    FFMPEG_TIMEOUTS.compatMax,
  )

  try {
    await runFfmpeg({ args, timeoutMs })
    await fs.rename(temp, filePath)
  } catch (error) {
    await fs.unlink(temp).catch(() => {})

    throw error
  }
}
