import { mapImageModel } from './image'
import { availabilityForModel } from './shared'
import type { MapCustomModelParams, MappedCustomModel } from './types'
import { mapVideoModel } from './video'

/** Pure upai model to preset mapping. Warnings describe dropped protocol values. */
export function mapCustomModel(params: MapCustomModelParams): MappedCustomModel {
  const { endpoint, model, maxUploadBytes = null } = params
  const availability = availabilityForModel(model)

  if (model.kind === 'image') {
    return mapImageModel({ endpoint, model, availability })
  }

  return mapVideoModel({ endpoint, model, availability, maxUploadBytes })
}
