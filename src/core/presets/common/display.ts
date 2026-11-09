import { isNil } from 'lodash-es'

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

interface CustomDisplayParams {
  outputSizes: OutputSizes | undefined
  resolution: string
  aspect: string
}

interface CustomChoicesParams {
  values: readonly string[]
  outputSizes: OutputSizes | undefined
  aspect: string
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

function customChoices(params: CustomChoicesParams): ResolutionChoice[] {
  const { values, outputSizes, aspect } = params
  let ordered: readonly string[] = values

  if (!isNil(outputSizes)) {
    ordered = [...values].sort((left, right) => {
      return areaOf(outputSizes[left]?.[aspect]) - areaOf(outputSizes[right]?.[aspect])
    })
  }

  return ordered.map((resolution) => {
    return { value: resolution, ...customDisplay({ outputSizes, resolution, aspect }) }
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

  return customDisplay({ outputSizes: preset.outputSizes, resolution, aspect })
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

  return customChoices({ values, outputSizes: preset.outputSizes, aspect })
}
