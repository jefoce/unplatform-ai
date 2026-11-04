import { isNil } from 'lodash-es'

import type { AspectRatio, Resolution, VideoPreset } from '../presets/video/types'
import { parseAspect, type PixelSize } from './geometry'

export const SHORT_SIDE = {
  '480p': 480,
  '720p': 720,
  '768p': 768,
  '1080p': 1080,
  '2K': 1440,
  '4K': 2160,
} as const

const even = (value: number): number => {
  return Math.round(value / 2) * 2
}

interface AspectAllowedParams {
  preset: VideoPreset
  resolution: Resolution
  aspect: AspectRatio
}

/** When a preset lists exact sizes, an aspect is valid only where a size exists. */
export function aspectAllowed(params: AspectAllowedParams): boolean {
  const { preset, resolution, aspect } = params

  if (!preset.outputSizes) {
    return preset.aspectRatios.includes(aspect)
  }

  return Boolean(preset.outputSizes[resolution]?.[aspect])
}

interface OutputSizeParams {
  preset: VideoPreset
  resolution: Resolution
  aspect: AspectRatio
}

/** Size from the preset's `WIDTHxHEIGHT` string, null when a part is missing. */
function parseExact(exact: string): PixelSize | null {
  const [width, height] = exact.split('x').map(Number)

  if (isNil(width) || isNil(height)) {
    return null
  }

  return { width, height }
}

/** Exact preset size when listed, else an even-dimension estimate from the short side. */
export function outputSize(params: OutputSizeParams): PixelSize | null {
  const { preset, resolution, aspect } = params
  const exact = preset.outputSizes?.[resolution]?.[aspect]

  if (!isNil(exact)) {
    return parseExact(exact)
  }

  const sides = parseAspect(aspect)

  if (isNil(sides)) {
    return null
  }

  const short = SHORT_SIDE[resolution]
  const [a, b] = sides

  if (a >= b) {
    return { width: even((short * a) / b), height: short }
  }

  return { width: short, height: even((short * b) / a) }
}
