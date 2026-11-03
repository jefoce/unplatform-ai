import 'server-only'

import { isNil } from 'lodash-es'

import type { ProviderModel, ProviderModelList } from '../types'
import { fetchVideoModelsResult, type VideoModel } from './video-models'

/** Live model capabilities from the shared list. */
export async function listModels(): Promise<ProviderModelList> {
  const { models, reason } = await fetchVideoModelsResult()

  return { models: models.map(toModel), isFresh: isNil(reason) }
}

function toModel(model: VideoModel): ProviderModel {
  return {
    modelId: model.id,
    durations: model.supported_durations ?? null,
    resolutions: model.supported_resolutions ?? null,
    aspectRatios: model.supported_aspect_ratios ?? null,
    frameImages: model.supported_frame_images ?? null,
    generatesAudio: model.generate_audio ?? null,
    hasSeed: model.seed ?? null,
  }
}
