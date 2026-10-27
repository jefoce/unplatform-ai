import 'server-only'

import { isEmpty, isNil } from 'lodash-es'
import { z } from 'zod'

import { FETCH_TIMEOUTS, PRICING_FALLBACK_TTL_MS } from '@/core/constants'
import { messageOf } from '@/core/errors'
import { primaryBinding } from '@/core/presets/bindings'
import type { ModelPreset } from '@/core/presets/types'
import type { PricingInfo } from '@/core/types'
import type { Dict } from '@/core/utility-types'

import { onSecretsChange } from '../../secrets'
import { createTtlCache, type TtlLoadResult } from '../../sync/ttl-cache'
import { issueSummary } from './http'
import { fetchVideoModelsResult } from './video-models'

const API_URL = 'https://openrouter.ai/api/v1'
const LIVE_TTL_MS = 3_600_000

const EndpointPricingSchema = z.object({ discount: z.number() }).loose()

const EndpointSchema = z.object({ pricing: EndpointPricingSchema.nullish() }).loose()

const EndpointsDataSchema = z.object({ endpoints: z.array(EndpointSchema) }).loose()

const EndpointsSchema = z.object({ data: EndpointsDataSchema }).loose()

const cache = createTtlCache<PricingInfo>({
  key: 'pricing',
  okTtlMs: LIVE_TTL_MS,
  failTtlMs: PRICING_FALLBACK_TTL_MS,
})

/** List and discounted rates. Live results cache for an hour, fallback for five minutes. */
export async function getPricing(preset: ModelPreset, isForce = false): Promise<PricingInfo> {
  return cache.get(
    preset.id,
    () => {
      return loadPricing(preset, isForce)
    },
    isForce,
  )
}

async function loadPricing(
  preset: ModelPreset,
  isForce: boolean,
): Promise<TtlLoadResult<PricingInfo>> {
  const info = await fetchPricing(preset, isForce)

  return { value: info, isOk: info.source === 'live' }
}

function fallback(preset: ModelPreset): PricingInfo {
  const listSkus = { ...primaryBinding(preset).pricing.fallback }

  return {
    skus: { ...listSkus },
    listSkus,
    discount: 0,
    source: 'fallback',
    fetchedAt: new Date().toISOString(),
  }
}

/** A broken endpoints call keeps the live list rates at discount 0. */
async function fetchPricing(preset: ModelPreset, isForce: boolean): Promise<PricingInfo> {
  const [listSkus, discount] = await Promise.all([
    fetchListSkus(preset, isForce),
    fetchDiscount(preset),
  ])

  if (!listSkus) {
    return fallback(preset)
  }

  let skus = { ...listSkus }

  if (discount > 0) {
    skus = applyDiscount(listSkus, discount)
  }

  return {
    skus,
    listSkus: { ...listSkus },
    discount,
    source: 'live',
    fetchedAt: new Date().toISOString(),
  }
}

async function fetchListSkus(preset: ModelPreset, isForce: boolean): Promise<Dict<number> | null> {
  const { modelId } = primaryBinding(preset)
  const { models, reason } = await fetchVideoModelsResult(isForce)

  if (!isNil(reason)) {
    warnFallback({ preset, modelId, reason, kind: 'list' })

    return null
  }

  const model = models.find((item) => {
    return item.id === modelId
  })

  if (isNil(model)) {
    warnFallback({ preset, modelId, reason: 'model missing from the list', kind: 'list' })

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

  warnFallback({ preset, modelId, reason: skusReason, kind: 'list' })

  return null
}

/** Reads the live fraction. One warning per fallback, never the URL or headers. */
export async function fetchDiscount(preset: ModelPreset): Promise<number> {
  const { modelId } = primaryBinding(preset)

  try {
    const res = await fetch(`${API_URL}/models/${modelId}/endpoints`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUTS.meta),
    })

    if (!res.ok) {
      warnFallback({ preset, modelId, reason: `HTTP ${res.status}`, kind: 'discount' })

      return 0
    }

    const parsed = EndpointsSchema.safeParse(await res.json())

    if (!parsed.success) {
      const reason = `invalid response (${issueSummary(parsed.error)})`

      warnFallback({ preset, modelId, reason, kind: 'discount' })

      return 0
    }

    // Reads the first endpoint. Each model has one provider today, add per-endpoint pricing before a second provider.
    const pricing = parsed.data.data.endpoints[0]?.pricing

    if (isNil(pricing)) {
      warnFallback({ preset, modelId, reason: 'no pricing block', kind: 'discount' })

      return 0
    }

    const raw = pricing.discount

    if (raw < 0 || raw > 1) {
      warnFallback({
        preset,
        modelId,
        reason: `discount ${String(raw)} out of range`,
        kind: 'discount',
      })

      return 0
    }

    return raw
  } catch (error) {
    warnFallback({ preset, modelId, reason: messageOf(error), kind: 'discount' })

    return 0
  }
}

type PricingFallbackKind = 'discount' | 'list'

interface PricingWarningParams {
  preset: ModelPreset
  modelId: string
  reason: string
  kind: PricingFallbackKind
}

function warnFallback(params: PricingWarningParams): void {
  const { preset, modelId, reason, kind } = params

  console.warn(`[pricing] ${preset.id} (${modelId}) ${kind} fallback: ${reason}`)
}

/** Keeps six significant digits so sub-cent token rates keep their precision. */
function applyDiscount(listSkus: Dict<number>, discount: number): Dict<number> {
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

onSecretsChange(() => {
  cache.clear()
})
