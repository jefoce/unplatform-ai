import 'server-only'

import { isNil } from 'lodash-es'
import { z } from 'zod'

import {
  FETCH_TIMEOUTS,
  MODEL_LIST_MAX_PAGES,
  PRICING_FALLBACK_TTL_MS,
  PRICING_LIVE_TTL_MS,
} from '@/core/constants'
import { messageOf } from '@/core/errors'
import { IMAGE_BILLABLE_KINDS, type ImagePriceLine, PRICE_UNITS } from '@/core/pricing/types'

import { registerSecretsListener } from '../../secrets'
import { createTtlCache, type TtlLoadResult } from '../../sync/ttl-cache'
import type { EndpointState, ProviderImageModel, ProviderImageModelList } from '../types'
import { BASE_URL, endpointsOf, issueSummary, nextPageUrl, optionalAuthHeaders } from './http'
import { type ImageCapabilities, readImageCapabilities } from './image-capabilities'

const MODELS_URL = `${BASE_URL}/api/v1/images/models`

const ListPageSchema = z.object({ data: z.array(z.unknown()) }).loose()

const PriceLineSchema = z
  .object({
    billable: z.enum(IMAGE_BILLABLE_KINDS),
    unit: z.enum(PRICE_UNITS),
    cost_usd: z.number(),
    variant: z.string().nullish(),
  })
  .loose()

const ModelEntrySchema = z
  .object({ id: z.string(), supported_parameters: z.unknown().optional() })
  .loose()

const EndpointEntrySchema = z
  .object({
    name: z.string().nullish(),
    provider_name: z.string().nullish(),
    supported_parameters: z.unknown().nullish(),
    pricing: z.array(PriceLineSchema).nullish(),
  })
  .loose()

export interface ImageEndpoint {
  name: string | null
  provider: string | null
  model: ImageCapabilities
  lines: readonly ImagePriceLine[]
}

export interface ImageModelsResult {
  models: readonly ProviderImageModel[]
  reason: string | null
}

export interface ImageEndpointsResult {
  endpoints: readonly ImageEndpoint[]
  reason: string | null
  state: EndpointState
}

const modelsCache = createTtlCache<ImageModelsResult>({
  key: 'imageModels',
  okTtlMs: PRICING_LIVE_TTL_MS,
  failTtlMs: PRICING_FALLBACK_TTL_MS,
})

const endpointsCache = createTtlCache<ImageEndpointsResult>({
  key: 'imageEndpoints',
  okTtlMs: PRICING_LIVE_TTL_MS,
  failTtlMs: PRICING_FALLBACK_TTL_MS,
})

let lastWarning: string | null = null

/** One warning per distinct reason, never per entry or refresh. */
function warnFallback(reason: string): void {
  if (reason === lastWarning) {
    return
  }

  lastWarning = reason
  console.warn(`[image-models] live list unavailable: ${reason}`)
}

export async function fetchImageModelsResult(isForce = false): Promise<ImageModelsResult> {
  return modelsCache.get('models', fetchModelsResult, isForce)
}

/** Live `/images/models`, shaped for the provider registry. */
export async function fetchImageModelList(isForce = false): Promise<ProviderImageModelList> {
  const { models, reason } = await fetchImageModelsResult(isForce)

  return { models, isFresh: isNil(reason) }
}

export async function fetchImageEndpointsResult(
  modelId: string,
  isForce = false,
): Promise<ImageEndpointsResult> {
  return endpointsCache.get(
    modelId,
    () => {
      return fetchEndpointsResult(modelId)
    },
    isForce,
  )
}

export async function fetchImageEndpoints(
  modelId: string,
  isForce = false,
): Promise<readonly ImageEndpoint[]> {
  const { endpoints } = await fetchImageEndpointsResult(modelId, isForce)

  return endpoints
}

async function fetchModelsResult(): Promise<TtlLoadResult<ImageModelsResult>> {
  try {
    const models: ProviderImageModel[] = []
    let skipped = 0
    let url = MODELS_URL
    let isComplete = false

    for (let page = 0; page < MODEL_LIST_MAX_PAGES; page += 1) {
      const res = await get(url)

      if (!res.ok) {
        return modelsFallback(`HTTP ${res.status}`)
      }

      const parsed = ListPageSchema.safeParse(await res.json())

      if (!parsed.success) {
        return modelsFallback(`invalid response (${issueSummary(parsed.error)})`)
      }

      const pageModels = readPageModels(parsed.data.data)

      models.push(...pageModels.models)
      skipped += pageModels.skipped

      const next = nextPageUrl(parsed.data, url)

      if (isNil(next)) {
        isComplete = true
        break
      }

      url = next
    }

    if (skipped > 0) {
      warnFallback(`skipped ${skipped} image models without a string id`)
    }

    if (!isComplete) {
      const reason = `more than ${MODEL_LIST_MAX_PAGES} pages`

      warnFallback(reason)

      return { value: { models, reason }, isOk: false }
    }

    return { value: { models, reason: null }, isOk: true }
  } catch (error) {
    return modelsFallback(messageOf(error))
  }
}

interface PageModels {
  models: ProviderImageModel[]
  skipped: number
}

function readPageModels(items: readonly unknown[]): PageModels {
  const models: ProviderImageModel[] = []
  let skipped = 0

  for (const item of items) {
    const entry = ModelEntrySchema.safeParse(item)

    if (!entry.success) {
      skipped += 1
      continue
    }

    models.push(toModel(entry.data))
  }

  return { models, skipped }
}

async function fetchEndpointsResult(modelId: string): Promise<TtlLoadResult<ImageEndpointsResult>> {
  try {
    const res = await get(`${MODELS_URL}/${modelId}/endpoints`)

    if (!res.ok) {
      if (res.status === 404) {
        return endpointsFallback('HTTP 404', 'not_found')
      }

      return endpointsFallback(`HTTP ${res.status}`, 'unknown')
    }

    const items = endpointsOf(await res.json())

    if (isNil(items)) {
      return endpointsFallback('invalid response (no endpoints array)', 'unknown')
    }

    if (items.length === 0) {
      return endpointsFallback('no endpoints', 'not_found')
    }

    const endpoints: ImageEndpoint[] = []

    for (const item of items) {
      const entry = EndpointEntrySchema.safeParse(item)

      if (entry.success) {
        endpoints.push(toEndpoint(modelId, entry.data))
      }
    }

    if (endpoints.length === 0) {
      return endpointsFallback('invalid endpoints', 'unknown')
    }

    return { value: { endpoints, reason: null, state: 'present' }, isOk: true }
  } catch (error) {
    return endpointsFallback(messageOf(error), 'unknown')
  }
}

async function get(url: string): Promise<Response> {
  return fetch(url, {
    cache: 'no-store',
    headers: optionalAuthHeaders(),
    signal: AbortSignal.timeout(FETCH_TIMEOUTS.meta),
  })
}

function toModel(entry: z.infer<typeof ModelEntrySchema>): ProviderImageModel {
  return { modelId: entry.id, ...readImageCapabilities(entry.id, entry.supported_parameters) }
}

function toEndpoint(modelId: string, entry: z.infer<typeof EndpointEntrySchema>): ImageEndpoint {
  return {
    name: entry.name ?? null,
    provider: entry.provider_name ?? null,
    model: readImageCapabilities(modelId, entry.supported_parameters),
    lines: (entry.pricing ?? []).map((line) => {
      return {
        billable: line.billable,
        unit: line.unit,
        costUsd: line.cost_usd,
        variant: line.variant ?? null,
      }
    }),
  }
}

function modelsFallback(reason: string): TtlLoadResult<ImageModelsResult> {
  warnFallback(reason)

  return { value: { models: [], reason }, isOk: false }
}

function endpointsFallback(
  reason: string,
  state: EndpointState,
): TtlLoadResult<ImageEndpointsResult> {
  warnFallback(reason)

  return { value: { endpoints: [], reason, state }, isOk: false }
}

/** Clears both live caches when keys change. */
export function registerImageModelsSecretsListener(): void {
  registerSecretsListener('image-models', () => {
    modelsCache.clear()
    endpointsCache.clear()
  })
}
