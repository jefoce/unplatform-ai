import 'server-only'

import path from 'node:path'

import { isNil } from 'lodash-es'

import { isNonEmptyString } from '@/core/guards'
import type { PricingConfig } from '@/core/pricing/types'
import {
  CustomEndpointFileSchema,
  type CustomEndpointPricing,
} from '@/core/schemas/custom-endpoint'

import { readJson } from '../fs/json-file'
import { STORAGE_ROOT } from '../paths'

/** The endpoints repo belongs to w-settings. Swap this for its path constant after the merge. */
const ENDPOINTS_FILE = path.join(STORAGE_ROOT, 'data', 'endpoints.json')

/** Endpoint id from the mapper convention `custom.<endpointId>.<modelId>`. */
export function endpointIdOf(presetId: string): string | null {
  if (!presetId.startsWith('custom.')) {
    return null
  }

  const [, endpointId] = presetId.split('.')

  if (!isNonEmptyString(endpointId)) {
    return null
  }

  return endpointId
}

/** One endpoint's pricing, null when the file or the endpoint is missing. */
async function loadEndpointPricing(endpointId: string): Promise<CustomEndpointPricing | null> {
  const file = await readJson(ENDPOINTS_FILE, CustomEndpointFileSchema)

  if (isNil(file)) {
    return null
  }

  const endpoint = file.endpoints.find((item) => {
    return item.id === endpointId
  })

  return endpoint?.pricing ?? null
}

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

  const endpointId = endpointIdOf(presetId)

  if (isNil(endpointId)) {
    return pricing
  }

  const override = await loadEndpointPricing(endpointId)
  const modelUsd = pricing.fallback.per_run ?? 0
  const perRun = runPrice({ pricing: override, modelUsd, seconds })

  return { ...pricing, fallback: { ...pricing.fallback, per_run: perRun } }
}
