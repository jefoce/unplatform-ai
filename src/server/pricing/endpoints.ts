import 'server-only'

import { isNil } from 'lodash-es'

import type { PricingConfig } from '@/core/pricing/types'

import { getEndpoint } from '../providers/custom/endpoint-source'
import { endpointIdFromPresetId } from '../providers/custom/preset-link'
import { customRunPriceFromUsd } from '../providers/custom/pricing'

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
  const perRun = customRunPriceFromUsd({ pricing: endpoint?.pricing ?? null, modelUsd, seconds })

  return { ...pricing, fallback: { ...pricing.fallback, per_run: perRun } }
}
