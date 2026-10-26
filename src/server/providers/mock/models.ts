import 'server-only'

import { MODEL_PRESETS } from '@/core/presets'
import { primaryBinding } from '@/core/presets/bindings'
import type { ModelPreset } from '@/core/presets/types'

import type { ProviderModel, ProviderModelList } from '../types'

/** Static capabilities for the four presets, no provider call. */
export async function listModels(): Promise<ProviderModelList> {
  return { models: MODEL_PRESETS.map(staticModel), isFresh: true }
}

function staticModel(preset: ModelPreset): ProviderModel {
  return {
    modelId: primaryBinding(preset).modelId,
    durations: preset.duration.options ?? allDurations(preset),
    resolutions: preset.resolutions,
    aspectRatios: preset.aspectRatios,
    frameImages: frameImages(preset),
    generatesAudio: preset.audio.supported,
    hasSeed: preset.seed,
  }
}

function allDurations(preset: ModelPreset): number[] {
  const { min, max } = preset.duration

  return Array.from({ length: max - min + 1 }, (_, index) => {
    return min + index
  })
}

function frameImages(preset: ModelPreset): readonly string[] | null {
  if (!preset.frames.start) {
    return null
  }

  if (!preset.frames.end) {
    return ['first_frame']
  }

  return ['first_frame', 'last_frame']
}
