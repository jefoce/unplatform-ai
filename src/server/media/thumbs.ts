import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { clamp, sortBy, sumBy } from 'lodash-es'

import {
  POSTER_WIDTHS,
  THUMB_ENCODER_VERSION,
  THUMB_TOUCH_MS,
  THUMB_UNUSED_DAYS,
  THUMB_WIDTH,
  THUMBS_MAX_BYTES,
  THUMBS_TARGET_BYTES,
} from '@/core/constants'
import type { MediaKind } from '@/core/media/media-types'

import { HttpError } from '../errors'
import { writeFileAtomic } from '../fs/atomic-file'
import { isOwnedName, removeOwnedFile } from '../fs/json-file'
import { THUMBS_DIR } from '../paths'
import { createLimiter } from '../sync/limiter'
import { extractPosterFrame } from './poster-frame'
import sharp, { SHARP_INPUT_OPTIONS } from './sharp'

export class ThumbUnavailableError extends HttpError {
  constructor() {
    super(404, 'Thumbnail unavailable')
  }
}

/** The source exists but its thumb is still being made, or may be next request. */
export class ThumbPendingError extends HttpError {
  constructor() {
    super(503, 'Thumbnail not ready')
  }
}

export interface ThumbInput {
  ref: string
  absolutePath: string
  kind: MediaKind
  mtimeMs: number
  width: number
}

export interface ThumbResult {
  filePath: string
  contentType: 'image/webp'
}

const MAX_CONCURRENT = 4
const MAX_WIDTH = Math.max(...POSTER_WIDTHS)
const WEBP_OPTIONS = { quality: 84, smartSubsample: true, effort: 5 } as const
const limiter = createLimiter('thumbQueue', MAX_CONCURRENT)
const inFlight = new Map<string, Promise<ThumbResult>>()

interface ThumbCacheKeyParams {
  ref: string
  mtimeMs: number
  width: number
  encoderVersion?: number
}

/** Cache file hash. The encoder version makes old soft thumbs miss. */
export function thumbCacheKey(params: ThumbCacheKeyParams): string {
  const { ref, mtimeMs, width, encoderVersion = THUMB_ENCODER_VERSION } = params

  return createHash('sha1').update(`${ref}:${mtimeMs}:${width}:${encoderVersion}`).digest('hex')
}

export async function getThumbnail(input: ThumbInput): Promise<ThumbResult> {
  if (input.kind === 'audio') {
    throw new ThumbUnavailableError()
  }

  const requestedWidth = Math.round(input.width)

  const isWidthInvalid = requestedWidth === 0 || Number.isNaN(requestedWidth)
  const widthValue = isWidthInvalid ? THUMB_WIDTH : requestedWidth
  const width = clamp(widthValue, 32, MAX_WIDTH)

  const hash = thumbCacheKey({ ref: input.ref, mtimeMs: input.mtimeMs, width })
  const filePath = path.join(THUMBS_DIR, `${hash}.webp`)

  await fs.mkdir(THUMBS_DIR, { recursive: true })

  const stats = await fs.stat(filePath).catch(() => {
    return null
  })

  if (stats) {
    // Touch at most once a day, so the sweep keeps hot files without churning mtime.
    if (Date.now() - stats.mtimeMs >= THUMB_TOUCH_MS) {
      await fs.utimes(filePath, new Date(), new Date()).catch(() => {})
    }

    return { filePath, contentType: 'image/webp' }
  }

  const shared = inFlight.get(hash)

  if (shared) {
    return shared
  }

  const task = createThumb({ input, hash, width, filePath }).finally(() => {
    inFlight.delete(hash)
  })

  inFlight.set(hash, task)

  return task
}

interface CreateThumbParams {
  input: ThumbInput
  hash: string
  width: number
  filePath: string
}

async function createThumb(params: CreateThumbParams): Promise<ThumbResult> {
  const { input, hash, width, filePath } = params

  try {
    const buffer = await limiter.run(() => {
      if (input.kind === 'image') {
        return renderImage(input.absolutePath, width)
      }

      return renderVideo({ absPath: input.absolutePath, hash, width })
    })

    await writeFileAtomic(filePath, buffer)

    return { filePath, contentType: 'image/webp' }
  } catch {
    throw new ThumbPendingError()
  }
}

async function renderImage(absPath: string, width: number): Promise<Buffer> {
  return sharp(absPath, SHARP_INPUT_OPTIONS)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp(WEBP_OPTIONS)
    .toBuffer()
}

interface RenderVideoParams {
  absPath: string
  hash: string
  width: number
}

async function renderVideo(params: RenderVideoParams): Promise<Buffer> {
  const { absPath, hash, width } = params
  const frame = path.join(THUMBS_DIR, `${hash}.${randomUUID()}.tmp.png`)

  try {
    await extractPosterFrame({ videoPath: absPath, width, outPath: frame })

    return await sharp(frame, SHARP_INPUT_OPTIONS).webp(WEBP_OPTIONS).toBuffer()
  } finally {
    await fs.unlink(frame).catch(() => {})
  }
}

interface SweepThumbsParams {
  dir?: string
  maxBytes?: number
  targetBytes?: number
}

/**
 * Deletes thumbs unused for 30 days, then trims the rest oldest-first while the
 * folder is over the size cap. Returns the number of files removed.
 */
export async function sweepThumbs(params: SweepThumbsParams = {}): Promise<number> {
  const {
    dir = THUMBS_DIR,
    maxBytes = THUMBS_MAX_BYTES,
    targetBytes = THUMBS_TARGET_BYTES,
  } = params

  const cutoff = Date.now() - THUMB_UNUSED_DAYS * 86_400_000
  const collected = await collectThumbs({ dir, cutoff })
  const total = sumBy(collected.files, 'size')

  if (total <= maxBytes) {
    return collected.removed
  }

  return collected.removed + (await trimThumbs({ files: collected.files, total, targetBytes }))
}

interface ThumbFile {
  file: string
  size: number
  mtimeMs: number
}

interface CollectThumbsParams {
  dir: string
  cutoff: number
}

interface CollectedThumbs {
  files: ThumbFile[]
  removed: number
}

async function collectThumbs(params: CollectThumbsParams): Promise<CollectedThumbs> {
  const { dir, cutoff } = params

  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => {
    return []
  })

  const files: ThumbFile[] = []
  let removed = 0

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue
    }

    if (!isOwnedName(entry.name)) {
      continue
    }

    const file = path.join(dir, entry.name)

    const stats = await fs.stat(file).catch(() => {
      return null
    })

    if (!stats) {
      continue
    }

    if (stats.mtimeMs < cutoff) {
      const didRemove = await removeThumb(file)

      if (didRemove) {
        removed += 1
      }

      continue
    }

    files.push({ file, size: stats.size, mtimeMs: stats.mtimeMs })
  }

  return { files, removed }
}

/** Removes one thumb without letting a single failure stop the sweep. */
async function removeThumb(file: string): Promise<boolean> {
  try {
    await removeOwnedFile(file)

    return true
  } catch (error) {
    console.warn('[unplatform-ai] thumb cleanup failed', error)

    return false
  }
}

interface TrimThumbsParams {
  files: ThumbFile[]
  total: number
  targetBytes: number
}

async function trimThumbs(params: TrimThumbsParams): Promise<number> {
  const { files, total: startTotal, targetBytes } = params
  let total = startTotal
  let removed = 0

  for (const item of sortBy(files, 'mtimeMs')) {
    if (total <= targetBytes) {
      break
    }

    if (!isOwnedName(item.file)) {
      continue
    }

    const didRemove = await removeThumb(item.file)

    if (didRemove) {
      total -= item.size
      removed += 1
    }
  }

  return removed
}
