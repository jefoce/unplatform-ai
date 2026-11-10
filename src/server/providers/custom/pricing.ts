import 'server-only'

import { isNil } from 'lodash-es'

import { primaryBinding } from '@/core/presets/common/bindings'
import type { ImagePreset } from '@/core/presets/image/types'
import type { VideoPreset } from '@/core/presets/video/types'
import type { CustomEndpoint, CustomEndpointPricing } from '@/core/schemas/custom-endpoint'

export interface CustomRunPriceParams {
  endpoint: CustomEndpoint
  preset: VideoPreset | ImagePreset
  duration: number
}

export interface CustomRunPriceFromUsdParams {
  pricing: CustomEndpointPricing | null
  modelUsd: number
  seconds: number
}

/** Endpoint override on one model run price. Null or `model` mode keeps `modelUsd`. */
export function customRunPriceFromUsd(params: CustomRunPriceFromUsdParams): number {
  const { pricing, modelUsd, seconds } = params

  if (isNil(pricing) || pricing.mode === 'model') {
    return modelUsd
  }

  if (pricing.mode === 'free') {
    return 0
  }

  if (pricing.mode === 'perSecond') {
    return pricing.usd * Math.max(seconds, 1)
  }

  return pricing.usd
}

/** Endpoint override, else the model run price, else 0. Never null. */
export function resolveCustomRunPrice(params: CustomRunPriceParams): number {
  const { endpoint, preset, duration } = params

  return customRunPriceFromUsd({
    pricing: endpoint.pricing,
    modelUsd: modelRunPrice(preset),
    seconds: duration,
  })
}

/** ponytail: w-pricing owns the perRun table keys, the first finite value is the run price. */
function modelRunPrice(preset: VideoPreset | ImagePreset): number {
  const pricing = primaryBinding(preset).pricing

  if (pricing.formula !== 'perRun') {
    return 0
  }

  const value = Object.values(pricing.fallback).find((rate) => {
    return Number.isFinite(rate)
  })

  if (isNil(value)) {
    return 0
  }

  return value
}
