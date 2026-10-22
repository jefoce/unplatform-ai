import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { clamp, sortBy, sumBy } from 'lodash-es'

import {
  PREVIEW_AT_SEC,
  THUMB_TOUCH_MS,
  THUMB_UNUSED_DAYS,
  THUMB_WIDTH,
  THUMBS_MAX_BYTES,
  THUMBS_TARGET_BYTES,
} from '@/core/constants'
import type { MediaKind } from '@/core/types'

import { THUMBS_DIR } from '../paths'
import { HttpError } from '../request-guard'
import { extractFrame } from './ffmpeg'
import sharp from './sharp'

class ThumbUnavailableError extends HttpError {
  constructor() {
    super(404, 'Thumbnail unavailable')
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
const inFlight = new Map<string, Promise<ThumbResult>>()
const waiters: Array<() => void> = []
let active = 0

export async function getThumbnail(input: ThumbInput): Promise<ThumbResult> {
  if (input.kind === 'audio') throw new ThumbUnavailableError()

  const requestedWidth = Math.round(input.width)
  const width = clamp(
    requestedWidth === 0 || Number.isNaN(requestedWidth) ? THUMB_WIDTH : requestedWidth,
    32,
    1280,
  )
  const hash = createHash('sha1').update(`${input.ref}:${input.mtimeMs}:${width}`).digest('hex')
  const filePath = path.join(THUMBS_DIR, `${hash}.webp`)

  await fs.mkdir(THUMBS_DIR, { recursive: true })
  const stats = await fs.stat(filePath).catch(() => null)

  if (stats) {
    // Touch at most once a day, so the sweep keeps hot files without churning mtime.
    if (Date.now() - stats.mtimeMs >= THUMB_TOUCH_MS) {
      await fs.utimes(filePath, new Date(), new Date()).catch(() => {})
    }

    return { filePath, contentType: 'image/webp' }
  }

  const shared = inFlight.get(hash)

  if (shared) return shared

  const task = createThumb({ input, hash, width, filePath }).finally(() => inFlight.delete(hash))

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
    const buffer = await withSlot(() => {
      if (input.kind === 'image') return renderImage(input.absolutePath, width)

      return renderVideo({ absPath: input.absolutePath, hash, width })
    })

    await writeAtomic(filePath, buffer)

    return { filePath, contentType: 'image/webp' }
  } catch {
    throw new ThumbUnavailableError()
  }
}

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiters.push(resolve))

  active += 1

  try {
    return await fn()
  } finally {
    active -= 1
    waiters.shift()?.()
  }
}

async function renderImage(absPath: string, width: number): Promise<Buffer> {
  return sharp(absPath)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 78 })
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
    await extractFrame({ videoPath: absPath, atSec: PREVIEW_AT_SEC, width, outPath: frame })

    return await sharp(frame).webp({ quality: 78 }).toBuffer()
  } finally {
    await fs.unlink(frame).catch(() => {})
  }
}

async function writeAtomic(filePath: string, data: Buffer): Promise<void> {
  const temp = `${filePath}.tmp-${randomUUID()}`

  try {
    await fs.writeFile(temp, data)
    await fs.rename(temp, filePath)
  } catch (error) {
    await fs.unlink(temp).catch(() => {})

    throw error
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

  if (total <= maxBytes) return collected.removed

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
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  const files: ThumbFile[] = []
  let removed = 0

  for (const entry of entries) {
    if (!entry.isFile()) continue

    const file = path.join(dir, entry.name)
    const stats = await fs.stat(file).catch(() => null)

    if (!stats) continue

    if (stats.mtimeMs < cutoff) {
      await fs.unlink(file).catch(() => {})
      removed += 1
      continue
    }

    files.push({ file, size: stats.size, mtimeMs: stats.mtimeMs })
  }

  return { files, removed }
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
    if (total <= targetBytes) break

    await fs.unlink(item.file).catch(() => {})
    total -= item.size
    removed += 1
  }

  return removed
}
