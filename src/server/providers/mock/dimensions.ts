import 'server-only'

import { isNil } from 'lodash-es'

import type { PixelSize } from '@/core/geometry'
import { outputSize } from '@/core/output-size'
import { MODEL_PRESETS } from '@/core/presets'
import { primaryBinding } from '@/core/presets/bindings'

interface MockDimensionsParams {
  model: unknown
  presetId: unknown
  resolution: unknown
  aspect: unknown
}

/** Sizes the mock from the model slug or preset id, falling back to 720p 16:9. */
export function mockDimensions(params: MockDimensionsParams): PixelSize {
  const { model, presetId, resolution, aspect } = params

  const preset =
    MODEL_PRESETS.find((item) => {
      return primaryBinding(item).modelId === model
    }) ??
    MODEL_PRESETS.find((item) => {
      return item.id === presetId
    })

  const res = preset?.resolutions.find((item) => {
    return item === resolution
  })

  if (isNil(preset) || isNil(res)) {
    return { width: 1280, height: 720 }
  }

  let ratio: (typeof preset.aspectRatios)[number] | undefined

  if (aspect !== 'auto') {
    ratio = preset.aspectRatios.find((item) => {
      return item === aspect
    })
  }

  return (
    outputSize({ preset, resolution: res, aspect: ratio ?? preset.defaultAspectRatio }) ?? {
      width: 1280,
      height: 720,
    }
  )
}
