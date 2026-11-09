import { clamp, isEmpty, isNil } from 'lodash-es'

import type { ModelAvailability } from '../../catalog'
import { CUSTOM_DURATION_MAX_SEC, CUSTOM_DURATION_OPTIONS_MAX } from '../../constants'
import { isNonEmptyString } from '../../guards'
import type { PricingConfig } from '../../pricing/types'
import type { UpaiDuration, UpaiModel } from '../../protocol/upai'
import type { OutputSizes, SizeByAspect } from '../common/output-sizes'
import { customPresetPrefix } from './index'
import type { DurationResult, MappedDuration, OutputSizesParams, OutputSizesResult } from './types'

export const CUSTOM_STALE_REASON = 'Workflow changed in ComfyUI since the last save'
export const CUSTOM_INVALID_REASON = 'This workflow cannot run in ComfyUI.'

const SIZE_PATTERN = /^(\d+)x(\d+)$/

/** Keeps the endpoint order and drops empty names without judging the value. */
export function nonEmptyStrings(values: readonly string[]): string[] {
  return values.filter((value) => {
    return isNonEmptyString(value)
  })
}

export function mapOutputSizes(params: OutputSizesParams): OutputSizesResult {
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

/** Ready and stale models stay usable, invalid ones keep their own status. */
export function availabilityForModel(model: UpaiModel): ModelAvailability {
  if (model.status === 'ready') {
    return { status: 'available', reason: null }
  }

  if (model.status === 'stale') {
    return { status: 'available', reason: CUSTOM_STALE_REASON }
  }

  return { status: 'invalid', reason: model.status_reason ?? CUSTOM_INVALID_REASON }
}

/** Capped max, or null when even the minimum sits above the cap. */
function cappedDurationMax(min: number, roundedMax: number): number | null {
  const capped = Math.min(roundedMax, CUSTOM_DURATION_MAX_SEC)

  if (capped < min) {
    return null
  }

  return capped
}

/** Floor the step, treating a missing or non-positive step as no grid. */
function stepOf(raw: UpaiDuration): number {
  if (!Number.isFinite(raw.step) || raw.step <= 1) {
    return 1
  }

  return Math.floor(raw.step)
}

interface BuildDurationParams {
  min: number
  roundedMax: number
  raw: UpaiDuration
}

/** Build the capped duration and its warnings from a valid rounded range. */
function buildDuration(params: BuildDurationParams): DurationResult {
  const { min, roundedMax, raw } = params
  const cappedMax = cappedDurationMax(min, roundedMax)

  if (isNil(cappedMax)) {
    return {
      duration: null,
      warnings: [`Duration is above the ${String(CUSTOM_DURATION_MAX_SEC)} s cap`],
    }
  }

  const warnings: string[] = []

  if (roundedMax > CUSTOM_DURATION_MAX_SEC) {
    warnings.push(`Duration capped at ${String(CUSTOM_DURATION_MAX_SEC)} s`)
  }

  const step = stepOf(raw)
  let gridMax = step > 1 ? min + Math.floor((cappedMax - min) / step) * step : cappedMax
  let options: readonly number[] | undefined

  if (step > 1) {
    const count = Math.floor((gridMax - min) / step) + 1

    if (count > CUSTOM_DURATION_OPTIONS_MAX) {
      gridMax = min + (CUSTOM_DURATION_OPTIONS_MAX - 1) * step
      warnings.push(`Duration options capped at ${String(CUSTOM_DURATION_OPTIONS_MAX)}`)
    }

    options = Array.from({ length: Math.floor((gridMax - min) / step) + 1 }, (_, index) => {
      return min + index * step
    })
  }

  const clampedDefault = clamp(Math.round(raw.default), min, gridMax)

  const defaultDuration =
    step > 1 ? min + Math.round((clampedDefault - min) / step) * step : clampedDefault

  const duration: MappedDuration = {
    min,
    max: gridMax,
    default: defaultDuration,
  }

  if (step > 1) {
    duration.step = step

    duration.options = options
  }

  return { duration, warnings }
}

export function mapDuration(raw: UpaiDuration | undefined): DurationResult {
  if (isNil(raw) || !Number.isFinite(raw.min) || !Number.isFinite(raw.max)) {
    return { duration: null, warnings: ['Duration is missing or invalid'] }
  }

  const min = Math.ceil(raw.min)
  const roundedMax = Math.floor(raw.max)

  if (roundedMax < min) {
    return { duration: null, warnings: ['Duration range is empty after rounding'] }
  }

  return buildDuration({ min, roundedMax, raw })
}

function parseSize(raw: string | undefined): `${number}x${number}` | null {
  if (isNil(raw)) {
    return null
  }

  const match = SIZE_PATTERN.exec(raw)

  if (isNil(match)) {
    return null
  }

  const width = Number(match[1])
  const height = Number(match[2])

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }

  return `${width}x${height}`
}

export function customPricing(model: UpaiModel): PricingConfig {
  return {
    formula: 'perRun',
    skuRules: [],
    fallback: { per_run: model.pricing.per_run_usd },
  }
}

export function presetIdFor(endpointId: string, modelId: string): string {
  return `${customPresetPrefix(endpointId)}${modelId}`
}
