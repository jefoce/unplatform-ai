import 'server-only'

import { isEmpty } from 'lodash-es'

import type { ProviderModel, ProviderModelList } from '../types'
import { fetchVideoModels, type VideoModel } from './video-models'

/** Live model capabilities from the shared list. */
export async function listModels(): Promise<ProviderModelList> {
  const models = (await fetchVideoModels()).map(toModel)

  return { models, isFresh: !isEmpty(models) }
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
