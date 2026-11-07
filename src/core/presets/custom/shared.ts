import { clamp, isNil } from 'lodash-es'

import type { ModelAvailability } from '../../catalog'
import { isOneOf } from '../../guards'
import type { PricingConfig } from '../../pricing/types'
import type { UpaiDuration, UpaiModel } from '../../protocol/upai'
import type { DurationResult, KeepListParams, KeptList, MappedDuration } from './types'

export const CUSTOM_STALE_REASON = 'Workflow changed in ComfyUI since the last save'
export const CUSTOM_INVALID_REASON = 'This workflow cannot run in ComfyUI.'

const SIZE_PATTERN = /^(\d+)x(\d+)$/

export function keepList<T extends string>(params: KeepListParams<T>): KeptList<T> {
  const { values, allowed, label } = params

  const kept = values.filter((value): value is T => {
    return isOneOf(allowed, value)
  })

  const dropped = values.filter((value) => {
    return !isOneOf(allowed, value)
  })

  return {
    kept,
    warnings: dropped.map((value) => {
      return `Dropped unsupported ${label} ${value}`
    }),
  }
}

export function pickDefault<T extends string>(kept: readonly T[], preferred: string): T {
  const [first] = kept

  if (isNil(first)) {
    throw new Error('Cannot pick a default from an empty list')
  }

  const found = kept.find((value) => {
    return value === preferred
  })

  return found ?? first
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

export function mapDuration(raw: UpaiDuration | undefined): DurationResult {
  if (isNil(raw) || !Number.isFinite(raw.min) || !Number.isFinite(raw.max)) {
    return { duration: null, warnings: ['Duration is missing or invalid'] }
  }

  const min = Math.ceil(raw.min)
  const max = Math.floor(raw.max)

  if (max < min) {
    return { duration: null, warnings: ['Duration range is empty after rounding'] }
  }

  let step = 1

  if (Number.isFinite(raw.step) && raw.step > 1) {
    step = Math.floor(raw.step)
  }

  const gridMax = step > 1 ? min + Math.floor((max - min) / step) * step : max
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

    duration.options = Array.from(
      { length: Math.floor((gridMax - min) / step) + 1 },
      (_, index) => {
        return min + index * step
      },
    )
  }

  return { duration, warnings: [] }
}

export function parseSize(raw: string | undefined): `${number}x${number}` | null {
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
  return `custom.${endpointId}.${modelId}`
}
