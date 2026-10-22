import 'server-only'

import { isEmpty, isNil } from 'lodash-es'
import { z } from 'zod'

import { FETCH_TIMEOUTS, PRICING_FALLBACK_TTL_MS } from '@/core/constants'
import type { ModelPreset } from '@/core/presets'
import type { PricingInfo } from '@/core/types'

import { globalState } from '../global-state'
import { isMockMode } from './client'

const API_URL = 'https://openrouter.ai/api/v1'
const MODELS_URL = `${API_URL}/videos/models`
const LIVE_TTL_MS = 3_600_000

const ModelSchema = z
  .object({
    id: z.string(),
    pricing_skus: z.record(z.string(), z.unknown()).optional(),
  })
  .loose()

const ModelsSchema = z.object({ data: z.array(ModelSchema) }).loose()

const EndpointSchema = z
  .object({ pricing: z.object({ discount: z.number() }).loose().optional() })
  .loose()

const EndpointsSchema = z
  .object({ data: z.object({ endpoints: z.array(EndpointSchema) }).loose() })
  .loose()

interface CacheEntry {
  info: PricingInfo
  at: number
}

const cache = globalState<Map<string, CacheEntry>>('pricing', () => new Map())

/** List and discounted rates. Live results cache for an hour, fallback for five minutes. */
export async function getPricing(preset: ModelPreset, isForce = false): Promise<PricingInfo> {
  if (isMockMode()) return mockPricing(preset)

  const cached = cache.get(preset.id)
  const ttl = cached?.info.source === 'live' ? LIVE_TTL_MS : PRICING_FALLBACK_TTL_MS

  if (!isForce && cached && Date.now() - cached.at < ttl) return cached.info

  const info = await fetchPricing(preset)

  cache.set(preset.id, { info, at: Date.now() })

  return info
}

function mockPricing(preset: ModelPreset): PricingInfo {
  const listSkus = { ...preset.pricing.fallback }

  return {
    skus: { ...listSkus },
    listSkus,
    discount: 0,
    source: 'mock',
    fetchedAt: new Date().toISOString(),
  }
}

function fallback(preset: ModelPreset): PricingInfo {
  const listSkus = { ...preset.pricing.fallback }

  return {
    skus: { ...listSkus },
    listSkus,
    discount: 0,
    source: 'fallback',
    fetchedAt: new Date().toISOString(),
  }
}

/** A broken endpoints call keeps the live list rates at discount 0. */
async function fetchPricing(preset: ModelPreset): Promise<PricingInfo> {
  const [listSkus, discount] = await Promise.all([fetchListSkus(preset), fetchDiscount(preset)])

  if (!listSkus) return fallback(preset)

  let skus = { ...listSkus }

  if (discount > 0) skus = applyDiscount(listSkus, discount)

  return {
    skus,
    listSkus: { ...listSkus },
    discount,
    source: 'live',
    fetchedAt: new Date().toISOString(),
  }
}

async function fetchListSkus(preset: ModelPreset): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(MODELS_URL, {
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUTS.meta),
    })

    if (!res.ok) return null

    const parsed = ModelsSchema.safeParse(await res.json())

    if (!parsed.success) return null

    const model = parsed.data.data.find((item) => item.id === preset.slug)

    return model ? readSkus(model.pricing_skus) : null
  } catch {
    return null
  }
}

async function fetchDiscount(preset: ModelPreset): Promise<number> {
  try {
    const res = await fetch(`${API_URL}/models/${preset.slug}/endpoints`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUTS.meta),
    })

    if (!res.ok) return 0

    const parsed = EndpointsSchema.safeParse(await res.json())

    if (!parsed.success) return 0

    // Reads the first endpoint. Each model has one provider today, add per-endpoint pricing before a second provider.
    const raw = parsed.data.data.endpoints[0]?.pricing?.discount

    return !isNil(raw) && raw >= 0 && raw <= 1 ? raw : 0
  } catch {
    return 0
  }
}

/** Keeps six significant digits so sub-cent token rates keep their precision. */
function applyDiscount(listSkus: Record<string, number>, discount: number): Record<string, number> {
  const skus: Record<string, number> = {}

  for (const [key, value] of Object.entries(listSkus)) {
    skus[key] = Number((value * (1 - discount)).toPrecision(6))
  }

  return skus
}

/** Converts every SKU value to a number, dropping non-finite entries. */
function readSkus(skus: Record<string, unknown> | undefined): Record<string, number> | null {
  if (!skus) return null

  const result: Record<string, number> = {}

  for (const [key, raw] of Object.entries(skus)) {
    const value = Number(raw)

    if (Number.isFinite(value)) result[key] = value
  }

  return isEmpty(result) ? null : result
}
