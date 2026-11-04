import 'server-only'

import { isNil } from 'lodash-es'

import type { SkuTable } from '@/core/pricing/types'
import type { ProviderId } from '@/core/providers/types'

import { isMockMode } from '../config/mock-mode'
import { globalState } from '../global-state'

export const PRICING_KINDS = ['video', 'image'] as const

type PricingKind = (typeof PRICING_KINDS)[number]

type LiveSource = 'live' | 'fallback'

/** Effective and list rates for one binding. */
export interface LivePricing {
  skus: SkuTable
  listSkus: SkuTable
  discountPct: number
  source: LiveSource
}

export interface LivePricingParams {
  provider: ProviderId
  kind: PricingKind
  modelId: string
  fallback: SkuTable
  presetId?: string
  isForce?: boolean
}

type LivePricingLoader = (params: LivePricingParams) => Promise<LivePricing>

const loaders = globalState<Map<string, LivePricingLoader>>('pricingLoaders', () => {
  return new Map()
})

function keyOf(provider: ProviderId, kind: PricingKind): string {
  return `${provider}:${kind}`
}

interface RegisterLivePricingParams {
  provider: ProviderId
  kind: PricingKind
  loader: LivePricingLoader
}

/** One adapter per provider and kind. A new provider adds an adapter and presets. */
export function registerLivePricing(params: RegisterLivePricingParams): void {
  const { provider, kind, loader } = params

  loaders.set(keyOf(provider, kind), loader)
}

export function fallbackPricing(fallback: SkuTable): LivePricing {
  const listSkus = { ...fallback }

  return { skus: { ...listSkus }, listSkus, discountPct: 0, source: 'fallback' }
}

/** Loader output, or the preset table when no adapter is registered or it throws. */
export async function loadLivePricing(params: LivePricingParams): Promise<LivePricing> {
  if (isMockMode()) {
    return fallbackPricing(params.fallback)
  }

  const loader = loaders.get(keyOf(params.provider, params.kind))

  if (isNil(loader)) {
    return fallbackPricing(params.fallback)
  }

  try {
    return await loader(params)
  } catch {
    return fallbackPricing(params.fallback)
  }
}
