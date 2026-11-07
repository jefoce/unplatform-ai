import { isEmpty } from 'lodash-es'

import type { UpaiCapabilities } from '../../protocol/upai'
import type { PresetIcon } from '../common/icon'
import { imageResolutionOptions } from '../common/options'
import type { PresetReferenceLimits } from '../common/reference-limits'
import {
  IMAGE_ASPECT_RATIOS,
  IMAGE_RESOLUTIONS,
  type ImageAspectChoice,
  type ImageOption,
  type ImageParam,
  type ImagePreset,
  type ImageResolution,
} from '../image/types'
import { CUSTOM_ERROR_RULES } from './errors'
import { customPricing, keepList, pickDefault, presetIdFor } from './shared'
import type { ImageParamContext, MappedCustomModel, MappedImageContext } from './types'

const CUSTOM_ICON: PresetIcon = 'sparkles'

export function mapImageModel(ctx: MappedImageContext): MappedCustomModel {
  const { endpoint, model, availability } = ctx
  const caps = model.capabilities

  const resolutions = keepList({
    values: caps.resolutions,
    allowed: IMAGE_RESOLUTIONS,
    label: 'resolution',
  })

  const aspects = keepList({
    values: caps.aspect_ratios,
    allowed: IMAGE_ASPECT_RATIOS,
    label: 'aspect ratio',
  })

  const warnings = [...resolutions.warnings, ...aspects.warnings]
  const hasResolution = !isEmpty(resolutions.kept)
  const hasAspect = !isEmpty(aspects.kept)
  const countMax = caps.count?.max ?? 0
  const defaultAspectRatio = imageDefaultAspect(aspects.kept, caps.default_aspect_ratio)
  let defaultResolution: ImageResolution | null = null
  let resolutionOptions: readonly ImageOption<ImageResolution>[] | null = null

  if (hasResolution) {
    defaultResolution = pickDefault(resolutions.kept, caps.default_resolution)
    resolutionOptions = imageResolutionOptions(resolutions.kept)
  }

  const preset: ImagePreset = {
    id: presetIdFor(endpoint.id, model.id),
    title: model.name,
    family: 'custom',
    description: model.description,
    icon: CUSTOM_ICON,
    resolutions: resolutionOptions,
    defaultResolution,
    aspectRatios: aspects.kept,
    defaultAspectRatio,
    qualities: null,
    defaultQuality: null,
    backgrounds: null,
    defaultBackground: null,
    params: imageParams({
      hasResolution,
      hasAspect,
      hasSeed: caps.seed,
      countMax,
      maxReferences: caps.references.image.max,
    }),
    maxN: Math.max(1, countMax),
    referenceMax: caps.references.image.max,
    referenceLimits: imageReferenceLimits(caps),
    seed: caps.seed,
    promptMaxChars: caps.prompt.max_chars,
    refLabel: 'image {n}',
    bindings: [{ provider: 'custom', modelId: model.id, pricing: customPricing(model) }],
    errors: CUSTOM_ERROR_RULES,
  }

  return { preset, availability, warnings }
}

function imageDefaultAspect(
  aspects: readonly ImageAspectChoice[],
  preferred: string,
): ImageAspectChoice {
  if (isEmpty(aspects)) {
    return 'auto'
  }

  return pickDefault(aspects, preferred)
}

function imageParams(ctx: ImageParamContext): ImageParam[] {
  const { hasResolution, hasAspect, hasSeed, countMax, maxReferences } = ctx
  const params: ImageParam[] = []

  if (countMax > 0) {
    params.push('n')
  }

  if (hasAspect) {
    params.push('aspect_ratio')
  }

  if (hasResolution) {
    params.push('resolution')
  }

  if (hasSeed) {
    params.push('seed')
  }

  if (maxReferences > 0) {
    params.push('input_references')
  }

  return params
}

function imageReferenceLimits(caps: UpaiCapabilities): PresetReferenceLimits {
  return {
    image: {
      maxBytes: caps.reference_limits.image.max_bytes,
      formats: caps.reference_limits.image.formats,
    },
  }
}
