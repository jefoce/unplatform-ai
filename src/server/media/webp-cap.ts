import 'server-only'

import sharp, { SHARP_INPUT_OPTIONS } from './sharp'

export const THUMB_MAX_BYTES = 51_200

const START_QUALITY = 86
const MIN_QUALITY = 50
const QUALITY_STEPS = 3
const MAX_SCALE_STEPS = 3
const SCALE_FACTOR = 0.85
const MIN_WIDTH = 32

export interface CappedWebp {
  buffer: Buffer
  quality: number
  width: number
  scaleSteps: number
}

export interface EncodeCappedParams {
  input: string | Buffer
  width: number
  maxBytes?: number
}

interface EncodeOnceParams {
  input: string | Buffer
  width: number
  quality: number
}

async function encodeOnce(params: EncodeOnceParams): Promise<Buffer> {
  const { input, width, quality } = params

  return sharp(input, SHARP_INPUT_OPTIONS)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, smartSubsample: true, effort: 6 })
    .toBuffer()
}

interface SearchParams {
  input: string | Buffer
  width: number
  maxBytes: number
}

interface SearchResult {
  buffer: Buffer
  quality: number
}

/** Highest quality under the cap, assuming the start quality is already over. */
async function searchQuality(params: SearchParams): Promise<SearchResult> {
  const { input, width, maxBytes } = params
  const floor = await encodeOnce({ input, width, quality: MIN_QUALITY })

  if (floor.length > maxBytes) {
    return { buffer: floor, quality: MIN_QUALITY }
  }

  let best: SearchResult = { buffer: floor, quality: MIN_QUALITY }
  let low = MIN_QUALITY + 1
  let high = START_QUALITY - 1

  for (let step = 0; step < QUALITY_STEPS && low <= high; step += 1) {
    const quality = Math.floor((low + high) / 2)
    const buffer = await encodeOnce({ input, width, quality })

    if (buffer.length > maxBytes) {
      high = quality - 1
      continue
    }

    best = { buffer, quality }
    low = quality + 1
  }

  return best
}

/**
 * Encodes a WebP under a byte cap by lowering quality, then width.
 * Returns the smallest buffer when the cap cannot be met.
 */
export async function encodeWebpUnderCap(params: EncodeCappedParams): Promise<CappedWebp> {
  const { input, width, maxBytes = THUMB_MAX_BYTES } = params
  let targetWidth = width
  let scaleSteps = 0

  const first = await encodeOnce({ input, width: targetWidth, quality: START_QUALITY })

  if (first.length <= maxBytes) {
    return { buffer: first, quality: START_QUALITY, width: targetWidth, scaleSteps }
  }

  let smallest: CappedWebp = {
    buffer: first,
    quality: START_QUALITY,
    width: targetWidth,
    scaleSteps,
  }

  for (;;) {
    const found = await searchQuality({ input, width: targetWidth, maxBytes })
    const candidate: CappedWebp = { ...found, width: targetWidth, scaleSteps }

    if (candidate.buffer.length <= maxBytes) {
      return candidate
    }

    if (candidate.buffer.length < smallest.buffer.length) {
      smallest = candidate
    }

    if (scaleSteps >= MAX_SCALE_STEPS) {
      break
    }

    const nextWidth = Math.max(MIN_WIDTH, Math.round(targetWidth * SCALE_FACTOR))

    if (nextWidth === targetWidth) {
      break
    }

    targetWidth = nextWidth
    scaleSteps += 1
  }

  console.warn(
    `[unplatform-ai] thumb over cap ${smallest.buffer.length} for ${smallest.width}px after ${smallest.scaleSteps} steps`,
  )

  return smallest
}
