import 'server-only'

import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import {
  BLUR_SATURATION,
  BLUR_SIGMA,
  BLUR_WIDTH,
  POSTER_WIDTHS,
  THUMB_ENCODER_VERSION,
  THUMB_WIDTH,
} from '@/core/constants'
import type { MediaKind } from '@/core/media/media-types'

import { isFileBusy, writeFileAtomic } from '../fs/atomic-file'
import { THUMBS_DIR } from '../paths'
import sharp, { SHARP_INPUT_OPTIONS, sharpQueue } from './sharp'
import {
  getThumbnail,
  thumbCacheKey,
  ThumbPendingError,
  type ThumbResult,
  ThumbUnavailableError,
} from './thumbs'

const MAX_WIDTH = Math.max(...POSTER_WIDTHS)
const WEBP_OPTIONS = { quality: 84, smartSubsample: true, effort: 5 } as const
const inFlight = new Map<string, Promise<ThumbResult>>()

export interface BlurInput {
  ref: string
  absolutePath: string
  kind: MediaKind
  mtimeMs: number
}

interface BlurCacheKeyParams {
  ref: string
  mtimeMs: number
}

/** Blur cache file hash, separate from every normal thumb width. */
export function blurCacheKey(params: BlurCacheKeyParams): string {
  const { ref, mtimeMs } = params

  return createHash('sha1')
    .update(`${ref}:${mtimeMs}:blur:${BLUR_WIDTH}:${BLUR_SIGMA}:${THUMB_ENCODER_VERSION}`)
    .digest('hex')
}

/**
 * Blurred stage backdrop from an existing thumb, 96 px wide.
 * Cached under its own hash so a normal thumb width never serves it.
 */
export async function getBlurredThumbnail(input: BlurInput): Promise<ThumbResult> {
  if (input.kind === 'audio') {
    throw new ThumbUnavailableError()
  }

  const hash = blurCacheKey({ ref: input.ref, mtimeMs: input.mtimeMs })
  const filePath = path.join(THUMBS_DIR, `${hash}.webp`)

  await fs.mkdir(THUMBS_DIR, { recursive: true })

  const stats = await fs.stat(filePath).catch(() => {
    return null
  })

  if (stats) {
    return { filePath, contentType: 'image/webp' }
  }

  const shared = inFlight.get(hash)

  if (shared) {
    return shared
  }

  const task = createBlurredThumb({ input, filePath }).finally(() => {
    inFlight.delete(hash)
  })

  inFlight.set(hash, task)

  return task
}

interface CreateBlurredThumbParams {
  input: BlurInput
  filePath: string
}

async function createBlurredThumb(params: CreateBlurredThumbParams): Promise<ThumbResult> {
  const { input, filePath } = params

  try {
    const source = await smallestCachedThumb(input)
    const sourcePath = source ?? (await getThumbnail({ ...input, width: THUMB_WIDTH })).filePath

    const buffer = await sharpQueue.run(() => {
      return sharp(sourcePath, SHARP_INPUT_OPTIONS)
        .resize({ width: BLUR_WIDTH })
        .blur(BLUR_SIGMA)
        .modulate({ saturation: BLUR_SATURATION })
        .webp(WEBP_OPTIONS)
        .toBuffer()
    })

    await writeFileAtomic(filePath, buffer)

    return { filePath, contentType: 'image/webp' }
  } catch (error) {
    if (error instanceof ThumbUnavailableError || error instanceof ThumbPendingError) {
      throw error
    }

    if (isFileBusy(error)) {
      throw new ThumbPendingError()
    }

    throw error
  }
}

/** The narrowest cache file this source already has, if any. */
async function smallestCachedThumb(input: BlurInput): Promise<string | null> {
  for (let width = 80; width <= MAX_WIDTH; width += 80) {
    const filePath = path.join(
      THUMBS_DIR,
      `${thumbCacheKey({ ref: input.ref, mtimeMs: input.mtimeMs, width })}.webp`,
    )

    const stats = await fs.stat(filePath).catch(() => {
      return null
    })

    if (stats) {
      return filePath
    }
  }

  return null
}
