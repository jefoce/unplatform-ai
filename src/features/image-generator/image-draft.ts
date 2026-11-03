import { isNil } from 'lodash-es'

import { IMAGE_COUNT_MAX } from '@/core/constants'
import type {
  ImageAspectChoice,
  ImageBackground,
  ImageOption,
  ImagePreset,
  ImageQuality,
  ImageResolution,
} from '@/core/presets/image/types'
import type { ImageGenerationInput } from '@/core/schemas/image-record'

import { imageReferenceMax } from './preset'

export interface ImageDefaults {
  count: number
  aspectRatio: ImageAspectChoice
  resolution: ImageResolution | null
  quality: ImageQuality | null
  background: ImageBackground | null
  seed: number | null
}

interface KeepOptionParams<T extends string> {
  options: readonly ImageOption<T>[] | null
  value: T | null
  fallback: T | null
}

/** Keeps a listed value, resets the rest, and hides the control when absent. */
function keepOption<T extends string>(params: KeepOptionParams<T>): T | null {
  const { options, value, fallback } = params

  if (isNil(options)) {
    return null
  }

  const isListed = options.some((option) => {
    return option.value === value
  })

  if (!isListed) {
    return fallback
  }

  return value
}

/** Control defaults from the preset, with count independent of the native n. */
export function imageDefaults(preset: ImagePreset): ImageDefaults {
  return {
    count: 1,
    aspectRatio: preset.defaultAspectRatio,
    resolution: preset.defaultResolution,
    quality: preset.defaultQuality,
    background: preset.defaultBackground,
    seed: null,
  }
}

/** Keeps the draft values the next preset supports and keeps references in its cap. */
export function imageDraftForPreset(
  draft: ImageGenerationInput,
  preset: ImagePreset,
): ImageGenerationInput {
  const hasAspectRatio = preset.aspectRatios.includes(draft.aspectRatio)
  const aspectRatio = hasAspectRatio ? draft.aspectRatio : preset.defaultAspectRatio

  const seed = preset.seed ? draft.seed : null

  return {
    presetId: preset.id,
    prompt: draft.prompt,
    count: clampImageCount(draft.count),
    aspectRatio,
    resolution: keepOption({
      options: preset.resolutions,
      value: draft.resolution,
      fallback: preset.defaultResolution,
    }),
    quality: keepOption({
      options: preset.qualities,
      value: draft.quality,
      fallback: preset.defaultQuality,
    }),
    background: keepOption({
      options: preset.backgrounds,
      value: draft.background,
      fallback: preset.defaultBackground,
    }),
    references: draft.references.slice(0, imageReferenceMax(preset)),
    seed,
  }
}

/** Keeps the stepper inside the contract bounds. */
export function clampImageCount(count: number): number {
  if (!Number.isFinite(count)) {
    return 1
  }

  return Math.min(Math.max(Math.round(count), 1), IMAGE_COUNT_MAX)
}
