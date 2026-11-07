import 'server-only'

import { isNil } from 'lodash-es'

import type { PricingConfig } from '@/core/pricing/types'
import type { CustomEndpointPricing } from '@/core/schemas/custom-endpoint'

import { getEndpoint } from '../providers/custom/endpoint-source'
import { endpointIdFromPresetId } from '../providers/custom/preset-link'

interface RunPriceParams {
  pricing: CustomEndpointPricing | null
  modelUsd: number
  seconds: number
}

/** Flat run price after the endpoint override. `perSecond` scales by billed seconds. */
function runPrice(params: RunPriceParams): number {
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

interface ResolveRunPricingParams {
  presetId: string
  pricing: PricingConfig
  seconds: number
}

/** Pricing with the endpoint override written into the `per_run` key. */
export async function resolveRunPricing(params: ResolveRunPricingParams): Promise<PricingConfig> {
  const { presetId, pricing, seconds } = params

  if (pricing.formula !== 'perRun') {
    return pricing
  }

  const endpointId = endpointIdFromPresetId(presetId)

  if (isNil(endpointId)) {
    return pricing
  }

  const endpoint = await getEndpoint(endpointId)
  const modelUsd = pricing.fallback.per_run ?? 0
  const perRun = runPrice({ pricing: endpoint?.pricing ?? null, modelUsd, seconds })

  return { ...pricing, fallback: { ...pricing.fallback, per_run: perRun } }
}
