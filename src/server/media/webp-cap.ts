import 'server-only'

import sharp, { SHARP_INPUT_OPTIONS } from './sharp'

export const THUMB_MAX_BYTES = 51_200

const START_QUALITY = 86
const SEARCH_LOW = 49
const SEARCH_HIGH = START_QUALITY - 1
const FLOOR_QUALITY = 50
const QUALITY_STEPS = 3
const FAST_EFFORT = 4
const FINAL_EFFORT = 6
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

interface Raster {
  data: Buffer
  width: number
  height: number
  channels: 1 | 2 | 3 | 4
}

interface RasterizeParams {
  input: string | Buffer
  width: number
}

/** Decodes and resizes once, so every quality attempt reuses the same pixels. */
async function rasterize(params: RasterizeParams): Promise<Raster> {
  const { input, width } = params

  const { data, info } = await sharp(input, SHARP_INPUT_OPTIONS)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true })

  return { data, width: info.width, height: info.height, channels: info.channels }
}

interface EncodeParams {
  raster: Raster
  quality: number
  effort: number
}

async function encode(params: EncodeParams): Promise<Buffer> {
  const { raster, quality, effort } = params
  const { data, width, height, channels } = raster

  return sharp(data, { raw: { width, height, channels } })
    .webp({ quality, smartSubsample: true, effort })
    .toBuffer()
}

interface RoundParams {
  raster: Raster
  maxBytes: number
  startQuality: number
}

interface RoundResult {
  buffer: Buffer
  quality: number
  isUnderCap: boolean
}

interface FinalizeParams {
  raster: Raster
  effortFour: Buffer
  quality: number
  maxBytes: number
}

/** Prefers the effort 6 result, then the effort 4 one at the same quality. */
async function finalize(params: FinalizeParams): Promise<RoundResult> {
  const { raster, effortFour, quality, maxBytes } = params
  const final = await encode({ raster, quality, effort: FINAL_EFFORT })

  if (final.length <= maxBytes) {
    return { buffer: final, quality, isUnderCap: true }
  }

  return { buffer: effortFour, quality, isUnderCap: effortFour.length <= maxBytes }
}

/** One width: a fast encode, a short quality search, then one final slow encode. */
async function encodeRound(params: RoundParams): Promise<RoundResult> {
  const { raster, maxBytes, startQuality } = params
  const fast = await encode({ raster, quality: startQuality, effort: FAST_EFFORT })

  if (fast.length <= maxBytes) {
    return finalize({ raster, effortFour: fast, quality: startQuality, maxBytes })
  }

  let best: RoundResult = { buffer: fast, quality: startQuality, isUnderCap: false }

  if (startQuality > FLOOR_QUALITY) {
    let low = SEARCH_LOW
    let high = Math.min(SEARCH_HIGH, startQuality - 1)

    for (let step = 0; step < QUALITY_STEPS && low <= high; step += 1) {
      const quality = Math.floor((low + high) / 2)
      const buffer = await encode({ raster, quality, effort: FAST_EFFORT })

      if (buffer.length > maxBytes) {
        high = quality - 1
        continue
      }

      best = { buffer, quality, isUnderCap: true }
      low = quality + 1
    }
  }

  if (!best.isUnderCap) {
    let floor: Buffer

    if (startQuality === FLOOR_QUALITY) {
      floor = fast
    } else {
      floor = await encode({ raster, quality: FLOOR_QUALITY, effort: FAST_EFFORT })
    }

    best = { buffer: floor, quality: FLOOR_QUALITY, isUnderCap: floor.length <= maxBytes }
  }

  return finalize({ raster, effortFour: best.buffer, quality: best.quality, maxBytes })
}

/**
 * Encodes a WebP under a byte cap by lowering quality, then width.
 * Returns the smallest buffer when the cap cannot be met.
 */
export async function encodeWebpUnderCap(params: EncodeCappedParams): Promise<CappedWebp> {
  const { input, width, maxBytes = THUMB_MAX_BYTES } = params
  let targetWidth = width
  let scaleSteps = 0
  let startQuality = START_QUALITY

  let raster = await rasterize({ input, width: targetWidth })
  let round = await encodeRound({ raster, maxBytes, startQuality })

  let smallest: CappedWebp = {
    buffer: round.buffer,
    quality: round.quality,
    width: raster.width,
    scaleSteps,
  }

  if (round.isUnderCap) {
    return smallest
  }

  while (scaleSteps < MAX_SCALE_STEPS) {
    const nextWidth = Math.max(MIN_WIDTH, Math.round(targetWidth * SCALE_FACTOR))

    if (nextWidth === targetWidth) {
      break
    }

    targetWidth = nextWidth
    scaleSteps += 1
    startQuality = round.quality

    raster = await rasterize({ input, width: targetWidth })
    round = await encodeRound({ raster, maxBytes, startQuality })

    const candidate: CappedWebp = {
      buffer: round.buffer,
      quality: round.quality,
      width: raster.width,
      scaleSteps,
    }

    if (round.isUnderCap) {
      return candidate
    }

    if (candidate.buffer.length < smallest.buffer.length) {
      smallest = candidate
    }
  }

  console.warn(
    `[unplatform-ai] thumb over cap ${smallest.buffer.length} for ${smallest.width}px after ${smallest.scaleSteps} steps`,
  )

  return smallest
}
