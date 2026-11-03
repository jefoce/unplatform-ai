import 'server-only'

import { isEmpty, isNil } from 'lodash-es'

import { PRICING_FALLBACK_TTL_MS, PRICING_LIVE_TTL_MS } from '@/core/constants'
import { primaryBinding } from '@/core/presets/common/bindings'
import type { VideoPreset } from '@/core/presets/video/types'
import { type PricingInfo, type SkuTable } from '@/core/pricing/types'
import type { Dict } from '@/core/utility-types'

import {
  fallbackPricing,
  type LivePricing,
  type LivePricingParams,
  loadLivePricing,
  registerLivePricing,
} from '../../pricing/live'
import { registerSecretsListener } from '../../secrets'
import { createTtlCache, type TtlLoadResult } from '../../sync/ttl-cache'
import { clearDiscountCache, fetchDiscountById } from './discount'
import { fetchImageEndpoints } from './images-models'
import { fetchVideoModelsResult } from './video-models'
import { warnFallback } from './warn'

const cache = createTtlCache<PricingInfo>({
  key: 'pricing',
  okTtlMs: PRICING_LIVE_TTL_MS,
  failTtlMs: PRICING_FALLBACK_TTL_MS,
})

/** List and discounted rates. Live results cache for an hour, fallback for five minutes. */
export async function getPricing(preset: VideoPreset, isForce = false): Promise<PricingInfo> {
  return cache.get(
    preset.id,
    () => {
      return loadPricing(preset, isForce)
    },
    isForce,
  )
}

async function loadPricing(
  preset: VideoPreset,
  isForce: boolean,
): Promise<TtlLoadResult<PricingInfo>> {
  const binding = primaryBinding(preset)

  const live = await loadLivePricing({
    provider: binding.provider,
    kind: 'video',
    modelId: binding.modelId,
    fallback: binding.pricing.fallback,
    presetId: preset.id,
    isForce,
  })

  return {
    value: {
      skus: live.skus,
      listSkus: live.listSkus,
      discount: live.discountPct,
      source: live.source,
      fetchedAt: new Date().toISOString(),
    },
    isOk: live.source === 'live',
  }
}

/** Wires the OpenRouter video and image pricing adapters once per process. */
export function registerOpenRouterPricing(): void {
  registerLivePricing({ provider: 'openrouter', kind: 'video', loader: loadVideoPricing })
  registerLivePricing({ provider: 'openrouter', kind: 'image', loader: loadImagePricing })
}

async function loadVideoPricing(params: LivePricingParams): Promise<LivePricing> {
  const { modelId, fallback, presetId, isForce } = params
  const label = presetId ?? modelId

  const [listSkus, discount] = await Promise.all([
    fetchListSkus({ modelId, label, isForce }),
    fetchDiscountById({ modelId, label, isForce }),
  ])

  if (isNil(listSkus)) {
    return fallbackPricing(fallback)
  }

  let skus = { ...listSkus }

  if (discount > 0) {
    skus = applyDiscount(listSkus, discount)
  }

  return { skus, listSkus: { ...listSkus }, discountPct: discount, source: 'live' }
}

/** Endpoint lines collapse to one key. The highest rate wins, err high. */
async function loadImagePricing(params: LivePricingParams): Promise<LivePricing> {
  const { modelId, fallback, isForce } = params
  const endpoints = await fetchImageEndpoints(modelId, isForce)

  if (isEmpty(endpoints)) {
    return fallbackPricing(fallback)
  }

  const rates = new Map<string, number[]>()

  for (const endpoint of endpoints) {
    for (const line of endpoint.lines) {
      const variant = line.variant?.toLowerCase() ?? 'base'
      const key = `${line.billable}_${variant}_${line.unit}`
      const values = rates.get(key) ?? []

      values.push(line.costUsd)
      rates.set(key, values)
    }
  }

  const skus: Dict<number> = {}

  for (const [key, values] of rates) {
    skus[key] = Math.max(...values)
    logSpread({ modelId, key, values })
  }

  return { skus, listSkus: { ...skus }, discountPct: 0, source: 'live' }
}

interface SpreadParams {
  modelId: string
  key: string
  values: readonly number[]
}

function logSpread(params: SpreadParams): void {
  const { modelId, key, values } = params

  if (process.env.NODE_ENV !== 'development' || values.length < 2) {
    return
  }

  const low = Math.min(...values)
  const high = Math.max(...values)

  if (low === high) {
    return
  }

  console.warn(`[pricing] image spread ${modelId} ${key}: ${String(low)}-${String(high)}`)
}

interface ListSkusParams {
  modelId: string
  label: string
  isForce?: boolean
}

async function fetchListSkus(params: ListSkusParams): Promise<Dict<number> | null> {
  const { modelId, label, isForce } = params
  const { models, reason } = await fetchVideoModelsResult(isForce)

  if (!isNil(reason)) {
    warnFallback({ label, modelId, reason, kind: 'list' })

    return null
  }

  const model = models.find((item) => {
    return item.id === modelId
  })

  if (isNil(model)) {
    warnFallback({ label, modelId, reason: 'model missing from the list', kind: 'list' })

    return null
  }

  const skus = readSkus(model.pricing_skus)

  if (!isNil(skus)) {
    return skus
  }

  const isSkusEmpty = isEmpty(model.pricing_skus)

  const skusReason = isSkusEmpty
    ? 'invalid pricing_skus (empty)'
    : 'invalid pricing_skus (no finite numbers)'

  warnFallback({ label, modelId, reason: skusReason, kind: 'list' })

  return null
}

/** Keeps six significant digits so sub-cent token rates keep their precision. */
function applyDiscount(listSkus: SkuTable, discount: number): Dict<number> {
  const skus: Dict<number> = {}

  for (const [key, value] of Object.entries(listSkus)) {
    skus[key] = Number((value * (1 - discount)).toPrecision(6))
  }

  return skus
}

/** Converts every SKU value to a number, dropping non-finite entries. */
function readSkus(skus: Dict<unknown> | undefined): Dict<number> | null {
  if (!skus) {
    return null
  }

  const result: Dict<number> = {}

  for (const [key, raw] of Object.entries(skus)) {
    const value = Number(raw)

    if (Number.isFinite(value)) {
      result[key] = value
    }
  }

  if (isEmpty(result)) {
    return null
  }

  return result
}

/** Clears the pricing cache when keys change. */
export function registerPricingSecretsListener(): void {
  registerSecretsListener('pricing', () => {
    cache.clear()
    clearDiscountCache()
  })
}
