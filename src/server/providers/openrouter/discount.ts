import 'server-only'

import { isNil } from 'lodash-es'
import { z } from 'zod'

import { FETCH_TIMEOUTS, PRICING_FALLBACK_TTL_MS, PRICING_LIVE_TTL_MS } from '@/core/constants'
import { messageOf } from '@/core/errors'
import { primaryBinding } from '@/core/presets/common/bindings'
import type { VideoPreset } from '@/core/presets/video/types'

import { createTtlCache, type TtlLoadResult } from '../../sync/ttl-cache'
import { issueSummary } from './http'
import { warnFallback } from './warn'

const API_URL = 'https://openrouter.ai/api/v1'

const EndpointPricingSchema = z.object({ discount: z.number() }).loose()

const EndpointSchema = z.object({ pricing: EndpointPricingSchema.nullish() }).loose()

const EndpointsDataSchema = z.object({ endpoints: z.array(EndpointSchema) }).loose()

const EndpointsSchema = z.object({ data: EndpointsDataSchema }).loose()

const discountCache = createTtlCache<number>({
  key: 'pricingDiscount',
  okTtlMs: PRICING_LIVE_TTL_MS,
  failTtlMs: PRICING_FALLBACK_TTL_MS,
})

/** Reads the live fraction for a preset. */
export async function fetchDiscount(preset: VideoPreset, isForce = false): Promise<number> {
  const { modelId } = primaryBinding(preset)

  return fetchDiscountById({ modelId, label: preset.id, isForce })
}

interface FetchDiscountParams {
  modelId: string
  label: string
  isForce?: boolean
}

export async function fetchDiscountById(params: FetchDiscountParams): Promise<number> {
  const { modelId, label, isForce } = params

  return discountCache.get(
    modelId,
    (previous) => {
      return loadDiscount({ modelId, label, previous })
    },
    isForce,
  )
}

export function clearDiscountCache(): void {
  discountCache.clear()
}

interface LoadDiscountParams {
  modelId: string
  label: string
  previous: number | undefined
}

async function loadDiscount(params: LoadDiscountParams): Promise<TtlLoadResult<number>> {
  const { modelId, label, previous } = params

  try {
    const res = await fetch(`${API_URL}/models/${modelId}/endpoints`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUTS.meta),
    })

    if (!res.ok) {
      warnFallback({ label, modelId, reason: `HTTP ${res.status}`, kind: 'discount' })

      return keepPrevious(res.status, previous)
    }

    const parsed = EndpointsSchema.safeParse(await res.json())

    if (!parsed.success) {
      const reason = `invalid response (${issueSummary(parsed.error)})`

      warnFallback({ label, modelId, reason, kind: 'discount' })

      return failedDiscount()
    }

    // Reads the first endpoint. Each model has one provider today, add per-endpoint pricing before a second provider.
    const pricing = parsed.data.data.endpoints[0]?.pricing

    if (isNil(pricing)) {
      warnFallback({ label, modelId, reason: 'no pricing block', kind: 'discount' })

      return failedDiscount()
    }

    const raw = pricing.discount

    if (raw < 0 || raw > 1) {
      warnFallback({
        label,
        modelId,
        reason: `discount ${String(raw)} out of range`,
        kind: 'discount',
      })

      return failedDiscount()
    }

    return { value: raw, isOk: true }
  } catch (error) {
    warnFallback({ label, modelId, reason: messageOf(error), kind: 'discount' })

    return failedDiscount()
  }
}

/** A 429 keeps the last known discount, so a burst does not zero the price. */
function keepPrevious(status: number, previous: number | undefined): TtlLoadResult<number> {
  if (status === 429 && !isNil(previous)) {
    return { value: previous, isOk: false }
  }

  return failedDiscount()
}

function failedDiscount(): TtlLoadResult<number> {
  return { value: 0, isOk: false }
}
