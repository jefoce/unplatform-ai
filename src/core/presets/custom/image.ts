import { isEmpty, isNil } from 'lodash-es'

import type { UpaiCapabilities } from '../../protocol/upai'
import type { PresetIcon } from '../common/icon'
import { imageResolutionOptions } from '../common/options'
import type { PresetReferenceLimits } from '../common/reference-limits'
import type { ImageAspectChoice, ImageOption, ImageParam, ImagePreset } from '../image/types'
import { CUSTOM_ERROR_RULES } from './errors'
import {
  customPricing,
  mapOutputSizes,
  mapReferenceLabel,
  mergeSizeOverrides,
  nonEmptyStrings,
  presetIdFor,
} from './shared'
import type { ImageParamContext, MappedCustomModel, MappedImageContext } from './types'

const CUSTOM_ICON: PresetIcon = 'sparkles'

interface ImageControls {
  resolutions: string[]
  aspects: string[]
  hasResolution: boolean
  hasAspect: boolean
}

interface ImageControlValues {
  resolutionOptions: readonly ImageOption<string>[] | null
  defaultResolution: string | null
  aspectRatios: readonly ImageAspectChoice[]
  defaultAspectRatio: string
}

function imageControls(caps: UpaiCapabilities): ImageControls {
  const resolutions = nonEmptyStrings(caps.resolutions)
  const aspects = nonEmptyStrings(caps.aspect_ratios)

  return {
    resolutions,
    aspects,
    hasResolution: !isEmpty(resolutions),
    hasAspect: !isEmpty(aspects),
  }
}

/** The first default that the endpoint list does not contain, null when both are valid. */
function missingImageDefault(caps: UpaiCapabilities, controls: ImageControls): string | null {
  const { resolutions, aspects, hasResolution, hasAspect } = controls

  if (hasResolution && !resolutions.includes(caps.default_resolution)) {
    return `Dropped model: default resolution ${caps.default_resolution} is not listed`
  }

  if (hasAspect && !aspects.includes(caps.default_aspect_ratio)) {
    return `Dropped model: default aspect ${caps.default_aspect_ratio} is not listed`
  }

  return null
}

function imageControlValues(caps: UpaiCapabilities, controls: ImageControls): ImageControlValues {
  const { resolutions, aspects, hasResolution, hasAspect } = controls
  let resolutionOptions: readonly ImageOption<string>[] | null = null
  let defaultResolution: string | null = null
  let aspectRatios: readonly ImageAspectChoice[] = ['auto']
  let defaultAspectRatio = 'auto'

  if (hasResolution) {
    resolutionOptions = imageResolutionOptions(resolutions)
    defaultResolution = caps.default_resolution
  }

  if (hasAspect) {
    aspectRatios = aspects
    defaultAspectRatio = caps.default_aspect_ratio
  }

  return { resolutionOptions, defaultResolution, aspectRatios, defaultAspectRatio }
}

export function mapImageModel(ctx: MappedImageContext): MappedCustomModel {
  const { endpoint, model, availability } = ctx
  const caps = model.capabilities
  const warnings: string[] = []
  const controls = imageControls(caps)
  const missingDefault = missingImageDefault(caps, controls)

  if (!isNil(missingDefault)) {
    warnings.push(missingDefault)

    return { preset: null, availability, warnings }
  }

  const sizes = mapOutputSizes({
    sizes: mergeSizeOverrides(caps.sizes, caps.size_overrides),
    resolutions: controls.resolutions,
    aspects: controls.aspects,
  })

  warnings.push(...sizes.warnings)

  const referenceLabel = mapReferenceLabel({
    raw: caps.prompt.reference_label,
    fallback: 'image {n}',
  })

  if (!isNil(referenceLabel.warning)) {
    warnings.push(referenceLabel.warning)
  }

  const countMax = caps.count?.max ?? 0
  const values = imageControlValues(caps, controls)

  const preset: ImagePreset = {
    id: presetIdFor(endpoint.id, model.id),
    title: model.name,
    family: 'custom',
    description: model.description,
    workflowName: model.workflow?.name ?? null,
    icon: CUSTOM_ICON,
    resolutions: values.resolutionOptions,
    defaultResolution: values.defaultResolution,
    aspectRatios: values.aspectRatios,
    defaultAspectRatio: values.defaultAspectRatio,
    outputSizes: sizes.sizes,
    qualities: null,
    defaultQuality: null,
    backgrounds: null,
    defaultBackground: null,
    params: imageParams({
      hasResolution: controls.hasResolution,
      hasAspect: controls.hasAspect,
      hasSeed: caps.seed,
      countMax,
      maxReferences: caps.references.image.max,
    }),
    maxN: Math.max(1, countMax),
    referenceMax: caps.references.image.max,
    referenceLimits: imageReferenceLimits(caps),
    referencesRequired: { image: caps.references.image.required, video: 0, audio: 0 },
    seed: caps.seed,
    promptMaxChars: caps.prompt.max_chars,
    promptOptional: !caps.prompt.required,
    refLabel: referenceLabel.refLabel,
    bindings: [{ provider: 'custom', modelId: model.id, pricing: customPricing(model) }],
    errors: CUSTOM_ERROR_RULES,
  }

  return { preset, availability, warnings }
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
