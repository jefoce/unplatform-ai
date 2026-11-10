import { isNil, maxBy, minBy } from 'lodash-es'

import type { ImagePreset } from '../image/types'
import type { VideoPreset } from '../video/types'
import type { OutputSizes } from './output-sizes'

const IMAGE_RESOLUTION_DETAILS: Record<string, string> = {
  '512': '512px',
  '768': '768px',
  '1K': '1024px',
  '1.5K': '1536px',
  '2K': '2048px',
  '4K': '4096px',
}

const SIZE_PATTERN = /^(\d+)x(\d+)$/

export interface ResolutionDisplay {
  label: string
  detail: string | null
}

export interface ResolutionDisplayParams {
  resolution: string
  aspect: string
}

export interface ResolutionChoice extends ResolutionDisplay {
  value: string
}

export interface ResolutionRangeParams {
  aspect: string
}

interface ShortSide {
  area: number
  short: number
}

interface SizedShortSidesParams {
  outputSizes: OutputSizes
  values: readonly string[]
  aspect: string
}

interface CustomDisplayParams {
  outputSizes: OutputSizes | undefined
  resolution: string
  aspect: string
}

interface CustomChoicesParams {
  values: readonly string[]
  outputSizes: OutputSizes | undefined
  aspect: string
  toDisplay: (params: CustomDisplayParams) => ResolutionDisplay
}

function sizeLabel(size: string): string {
  const match = SIZE_PATTERN.exec(size)

  if (isNil(match)) {
    return size
  }

  return `${match[1]}×${match[2]}`
}

function areaOf(size: string | undefined): number {
  if (isNil(size)) {
    return Number.POSITIVE_INFINITY
  }

  const match = SIZE_PATTERN.exec(size)

  if (isNil(match)) {
    return Number.POSITIVE_INFINITY
  }

  return Number(match[1]) * Number(match[2])
}

/** Shortest side of a `WxH` size string, null when malformed. */
export function shortSideOf(size: string): number | null {
  const match = SIZE_PATTERN.exec(size)

  if (isNil(match)) {
    return null
  }

  return Math.min(Number(match[1]), Number(match[2]))
}

function sizedShortSides(params: SizedShortSidesParams): ShortSide[] {
  const { outputSizes, values, aspect } = params
  const sides: ShortSide[] = []

  for (const resolution of values) {
    const size = outputSizes[resolution]?.[aspect]

    if (isNil(size)) {
      continue
    }

    const short = shortSideOf(size)

    if (isNil(short)) {
      continue
    }

    sides.push({ area: areaOf(size), short })
  }

  return sides
}

function customDisplay(params: CustomDisplayParams): ResolutionDisplay {
  const { outputSizes, resolution, aspect } = params

  if (isNil(outputSizes)) {
    return { label: resolution, detail: null }
  }

  const size = outputSizes[resolution]?.[aspect]

  if (isNil(size)) {
    return { label: resolution, detail: null }
  }

  return { label: sizeLabel(size), detail: resolution }
}

function customImageDisplay(params: CustomDisplayParams): ResolutionDisplay {
  const { outputSizes, resolution, aspect } = params
  const size = outputSizes?.[resolution]?.[aspect]

  if (isNil(size)) {
    return { label: resolution, detail: null }
  }

  const short = shortSideOf(size)

  if (isNil(short)) {
    return { label: resolution, detail: null }
  }

  return { label: resolution, detail: `${short}px` }
}

function customChoices(params: CustomChoicesParams): ResolutionChoice[] {
  const { values, outputSizes, aspect, toDisplay } = params
  let ordered: readonly string[] = values

  if (!isNil(outputSizes)) {
    ordered = [...values].sort((left, right) => {
      return areaOf(outputSizes[left]?.[aspect]) - areaOf(outputSizes[right]?.[aspect])
    })
  }

  return ordered.map((resolution) => {
    return { value: resolution, ...toDisplay({ outputSizes, resolution, aspect }) }
  })
}

/** Label and secondary detail for one video resolution at the current aspect. */
export function resolutionDisplay(
  preset: VideoPreset,
  params: ResolutionDisplayParams,
): ResolutionDisplay {
  const { resolution, aspect } = params

  if (preset.family !== 'custom') {
    return { label: resolution, detail: null }
  }

  return customDisplay({ outputSizes: preset.outputSizes, resolution, aspect })
}

/** Compact short-side height for a custom video resolution, null for API models. */
export function resolutionHeight(
  preset: VideoPreset,
  params: ResolutionDisplayParams,
): string | null {
  const { resolution, aspect } = params

  if (preset.family !== 'custom') {
    return null
  }

  const size = preset.outputSizes?.[resolution]?.[aspect]

  if (isNil(size)) {
    return null
  }

  const short = shortSideOf(size)

  if (isNil(short)) {
    return null
  }

  return `${short}p`
}

/** Short-side range across a custom video preset, raw first-last without sizes. */
export function resolutionRange(preset: VideoPreset, params: ResolutionRangeParams): string | null {
  const { aspect } = params
  const values = preset.resolutions
  const [first] = values
  const last = values.at(-1)

  if (isNil(first) || isNil(last)) {
    return null
  }

  const outputSizes = preset.outputSizes

  if (!isNil(outputSizes)) {
    const current = sizedShortSides({ outputSizes, values, aspect })
    let sides = current

    if (current.length === 0) {
      sides = sizedShortSides({ outputSizes, values, aspect: preset.defaultAspectRatio })
    }

    const smallest = minBy(sides, (side) => {
      return side.area
    })

    const largest = maxBy(sides, (side) => {
      return side.area
    })

    if (!isNil(smallest) && !isNil(largest)) {
      if (smallest.short === largest.short) {
        return `${smallest.short}p`
      }

      return `${smallest.short}\u2013${largest.short}p`
    }
  }

  if (first === last) {
    return first
  }

  return `${first}\u2013${last}`
}

/** Video options in display order, cheapest pixel area first for custom presets. */
export function videoResolutionChoices(preset: VideoPreset, aspect: string): ResolutionChoice[] {
  if (preset.family !== 'custom') {
    return preset.resolutions.map((value) => {
      return { value, label: value, detail: null }
    })
  }

  return customChoices({
    values: preset.resolutions,
    outputSizes: preset.outputSizes,
    aspect,
    toDisplay: customDisplay,
  })
}

/** Label and secondary detail for one image resolution at the current aspect. */
export function imageResolutionDisplay(
  preset: ImagePreset,
  params: ResolutionDisplayParams,
): ResolutionDisplay {
  const { resolution, aspect } = params

  if (preset.family !== 'custom') {
    return { label: resolution, detail: IMAGE_RESOLUTION_DETAILS[resolution] ?? null }
  }

  return customImageDisplay({ outputSizes: preset.outputSizes, resolution, aspect })
}

/** Image options in display order, cheapest pixel area first for custom presets. */
export function imageResolutionChoices(preset: ImagePreset, aspect: string): ResolutionChoice[] {
  const values =
    preset.resolutions?.map((option) => {
      return option.value
    }) ?? []

  if (preset.family !== 'custom') {
    return values.map((value) => {
      return {
        value,
        label: value,
        detail: IMAGE_RESOLUTION_DETAILS[value] ?? null,
      }
    })
  }

  return customChoices({
    values,
    outputSizes: preset.outputSizes,
    aspect,
    toDisplay: customImageDisplay,
  })
}
