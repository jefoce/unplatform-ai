import { isEmpty, isNil } from 'lodash-es'

import { CUSTOM_REF_TOTAL_SEC } from '../../constants'
import type { MediaKindCounts } from '../../media/media-types'
import type { UpaiCapabilities } from '../../protocol/upai'
import type { PresetIcon } from '../common/icon'
import type { PresetReferenceLimits } from '../common/reference-limits'
import {
  ASPECT_RATIOS,
  type AspectRatio,
  type Resolution,
  RESOLUTIONS,
  type VideoPreset,
} from '../video/types'
import { CUSTOM_ERROR_RULES } from './errors'
import { keepList, mapDuration, parseSize, pickDefault, presetIdFor } from './shared'
import type {
  MappedCustomModel,
  MappedDuration,
  MappedVideoContext,
  OutputSizes,
  OutputSizesParams,
  OutputSizesResult,
  SizeByAspect,
} from './types'

const CUSTOM_ICON: PresetIcon = 'sparkles'

export function mapVideoModel(ctx: MappedVideoContext): MappedCustomModel {
  const { endpoint, model, availability, maxUploadBytes } = ctx
  const caps = model.capabilities
  const warnings: string[] = []
  const duration = mapDuration(caps.duration)

  warnings.push(...duration.warnings)

  const resolutions = keepList({
    values: caps.resolutions,
    allowed: RESOLUTIONS,
    label: 'resolution',
  })

  const aspects = keepList({
    values: caps.aspect_ratios,
    allowed: ASPECT_RATIOS,
    label: 'aspect ratio',
  })

  warnings.push(...resolutions.warnings, ...aspects.warnings)

  if (isNil(duration.duration) || isEmpty(resolutions.kept) || isEmpty(aspects.kept)) {
    return { preset: null, availability, warnings }
  }

  const sizes = mapOutputSizes({
    sizes: caps.sizes,
    resolutions: resolutions.kept,
    aspects: aspects.kept,
  })

  warnings.push(...sizes.warnings)

  return {
    preset: buildVideoPreset({
      endpointId: endpoint.id,
      modelId: model.id,
      title: model.name,
      description: model.description,
      workflowName: model.workflow?.name ?? null,
      caps,
      duration: duration.duration,
      resolutions: resolutions.kept,
      aspects: aspects.kept,
      sizes: sizes.sizes,
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
  resolutions: readonly Resolution[]
  aspects: readonly AspectRatio[]
  sizes: OutputSizes | undefined
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
    defaultAspectRatio: pickDefault(aspects, caps.default_aspect_ratio),
    autoAspectWithFrames: false,
    promptOptional: !caps.prompt.required,
    resolutions,
    defaultResolution: pickDefault(resolutions, caps.default_resolution),
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
    refLabel: '{Kind} {n}',
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

function mapOutputSizes(params: OutputSizesParams): OutputSizesResult {
  const { sizes, resolutions, aspects } = params
  const result: OutputSizes = {}
  const warnings: string[] = []

  for (const resolution of resolutions) {
    const rawAspects = sizes[resolution] ?? {}
    const perResolution: SizeByAspect = {}

    for (const aspect of aspects) {
      const raw = rawAspects[aspect]
      const size = parseSize(raw)

      if (isNil(raw)) {
        continue
      }

      if (isNil(size)) {
        warnings.push(`Dropped malformed size ${raw} for ${resolution} ${aspect}`)
        continue
      }

      perResolution[aspect] = size
    }

    if (!isEmpty(perResolution)) {
      result[resolution] = perResolution
    }
  }

  if (isEmpty(result)) {
    return { sizes: undefined, warnings }
  }

  return { sizes: result, warnings }
}
