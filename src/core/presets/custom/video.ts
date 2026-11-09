import { isEmpty, isNil } from 'lodash-es'

import { CUSTOM_REF_TOTAL_SEC } from '../../constants'
import type { MediaKind, MediaKindCounts } from '../../media/media-types'
import type { UpaiCapabilities } from '../../protocol/upai'
import type { PresetIcon } from '../common/icon'
import type { OutputSizes } from '../common/output-sizes'
import type { PresetReferenceLimits } from '../common/reference-limits'
import type { VideoPreset } from '../video/types'
import { CUSTOM_ERROR_RULES } from './errors'
import {
  mapDuration,
  mapOutputSizes,
  mapReferenceLabels,
  mergeSizeOverrides,
  nonEmptyStrings,
  presetIdFor,
} from './shared'
import type { MappedCustomModel, MappedDuration, MappedVideoContext } from './types'

const CUSTOM_ICON: PresetIcon = 'sparkles'

export function mapVideoModel(ctx: MappedVideoContext): MappedCustomModel {
  const { endpoint, model, availability, maxUploadBytes } = ctx
  const caps = model.capabilities
  const warnings: string[] = []
  const duration = mapDuration(caps.duration)

  warnings.push(...duration.warnings)

  const resolutions = nonEmptyStrings(caps.resolutions)
  const aspects = nonEmptyStrings(caps.aspect_ratios)

  if (isNil(duration.duration) || isEmpty(resolutions) || isEmpty(aspects)) {
    return { preset: null, availability, warnings }
  }

  if (!resolutions.includes(caps.default_resolution)) {
    warnings.push(`Dropped model: default resolution ${caps.default_resolution} is not listed`)

    return { preset: null, availability, warnings }
  }

  if (!aspects.includes(caps.default_aspect_ratio)) {
    warnings.push(`Dropped model: default aspect ${caps.default_aspect_ratio} is not listed`)

    return { preset: null, availability, warnings }
  }

  const sizes = mapOutputSizes({
    sizes: mergeSizeOverrides(caps.sizes, caps.size_overrides),
    resolutions,
    aspects,
  })

  warnings.push(...sizes.warnings)

  const referenceLabels = mapReferenceLabels({
    shared: caps.prompt.reference_label,
    perKind: caps.prompt.reference_labels,
    fallback: '{Kind} {n}',
  })

  warnings.push(...referenceLabels.warnings)

  return {
    preset: buildVideoPreset({
      endpointId: endpoint.id,
      modelId: model.id,
      title: model.name,
      description: model.description,
      workflowName: model.workflow?.name ?? null,
      caps,
      duration: duration.duration,
      resolutions,
      aspects,
      sizes: sizes.sizes,
      refLabel: referenceLabels.refLabel,
      refLabels: referenceLabels.refLabels,
      maxUploadBytes,
      perRunUsd: model.pricing.per_run_usd,
    }),
    availability,
    warnings,
  }
}

interface BuildVideoParams {
  endpointId: string
  modelId: string
  title: string
  description: string
  workflowName: string | null
  caps: UpaiCapabilities
  duration: MappedDuration
  resolutions: readonly string[]
  aspects: readonly string[]
  sizes: OutputSizes | undefined
  refLabel: string
  refLabels: Record<MediaKind, string>
  maxUploadBytes: number | null
  perRunUsd: number
}

function buildVideoPreset(params: BuildVideoParams): VideoPreset {
  const {
    endpointId,
    modelId,
    title,
    description,
    workflowName,
    caps,
    duration,
    resolutions,
    aspects,
    sizes,
    refLabel,
    refLabels,
    maxUploadBytes,
    perRunUsd,
  } = params

  return {
    id: presetIdFor(endpointId, modelId),
    title,
    family: 'custom',
    description,
    workflowName,
    icon: CUSTOM_ICON,
    duration,
    aspectRatios: aspects,
    defaultAspectRatio: caps.default_aspect_ratio,
    autoAspectWithFrames: false,
    promptOptional: !caps.prompt.required,
    resolutions,
    defaultResolution: caps.default_resolution,
    audio: { supported: false, default: false },
    frames: {
      start: caps.frames?.start ?? false,
      end: caps.frames?.end ?? false,
      startRequired: caps.frames?.start_required ?? false,
      endRequired: caps.frames?.end_required ?? false,
    },
    references: {
      image: caps.references.image.max,
      video: caps.references.video.max,
      audio: caps.references.audio.max,
      videoTotalSec: CUSTOM_REF_TOTAL_SEC,
      audioTotalSec: CUSTOM_REF_TOTAL_SEC,
    },
    referencesRequired: referencesRequiredFor(caps),
    referenceLimits: videoReferenceLimits(caps, maxUploadBytes),
    maxInputPlusOutputSec: null,
    promptMaxChars: caps.prompt.max_chars,
    seed: caps.seed,
    refLabel,
    refLabels,
    outputSizes: sizes,
    bindings: [
      {
        provider: 'custom',
        modelId,
        pricing: {
          formula: 'perRun',
          skuRules: [],
          fallback: { per_run: perRunUsd },
        },
        transport: { image: 'base64', video: 'upload', audio: 'upload' },
      },
    ],
    errors: CUSTOM_ERROR_RULES,
  }
}

function referencesRequiredFor(caps: UpaiCapabilities): MediaKindCounts {
  return {
    image: caps.references.image.required,
    video: caps.references.video.required,
    audio: caps.references.audio.required,
  }
}

function videoReferenceLimits(
  caps: UpaiCapabilities,
  maxUploadBytes: number | null,
): PresetReferenceLimits {
  const limits: PresetReferenceLimits = {
    image: {
      maxBytes: caps.reference_limits.image.max_bytes,
      formats: caps.reference_limits.image.formats,
    },
  }

  if (!isNil(maxUploadBytes) && maxUploadBytes > 0) {
    limits.video = { maxBytes: maxUploadBytes }
    limits.audio = { maxBytes: maxUploadBytes }
  }

  return limits
}
