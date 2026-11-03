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

import { registerSecretsListener } from '../../secrets'
import { createTtlCache, type TtlLoadResult } from '../../sync/ttl-cache'
import type { EndpointSignal } from '../types'
import { BASE_URL, endpointsOf, issueSummary, nextPageUrl, optionalAuthHeaders } from './http'

const MODELS_URL = `${BASE_URL}/api/v1/videos/models`
const MODEL_URL = `${BASE_URL}/api/v1/models`

const VideoModelSchema = z
  .object({
    id: z.string(),
    pricing_skus: z.record(z.string(), z.unknown()).optional(),
    // The live list sends null for fields a model does not use.
    supported_durations: z.array(z.number()).nullish(),
    supported_resolutions: z.array(z.string()).nullish(),
    supported_aspect_ratios: z.array(z.string()).nullish(),
    supported_frame_images: z.array(z.string()).nullish(),
    generate_audio: z.boolean().nullish(),
    seed: z.boolean().nullish(),
  })
  .loose()

export type VideoModel = z.infer<typeof VideoModelSchema>

const ListPageSchema = z.object({ data: z.array(z.unknown()) }).loose()

/** Valid models plus the reason the list fell back to empty, if it did. */
export interface VideoModelsResult {
  models: readonly VideoModel[]
  reason: string | null
}

const cache = createTtlCache<VideoModelsResult>({
  key: 'videoModels',
  okTtlMs: PRICING_LIVE_TTL_MS,
  failTtlMs: PRICING_FALLBACK_TTL_MS,
})

const endpointsCache = createTtlCache<EndpointSignal>({
  key: 'videoModelEndpoints',
  okTtlMs: PRICING_LIVE_TTL_MS,
  failTtlMs: PRICING_FALLBACK_TTL_MS,
})

/** Shared list with the fallback reason kept for the pricing warning. */
export async function fetchVideoModelsResult(isForce = false): Promise<VideoModelsResult> {
  return cache.get('models', fetchModelsResult, isForce)
}

export async function fetchVideoEndpoints(
  modelId: string,
  isForce = false,
): Promise<EndpointSignal> {
  return endpointsCache.get(
    modelId,
    () => {
      return fetchEndpointSignal(modelId)
    },
    isForce,
  )
}

async function fetchModelsResult(): Promise<TtlLoadResult<VideoModelsResult>> {
  try {
    const models: VideoModel[] = []
    let skipped = 0
    let url = MODELS_URL
    let isComplete = false

    for (let page = 0; page < MODEL_LIST_MAX_PAGES; page += 1) {
      const res = await fetch(url, {
        cache: 'no-store',
        headers: optionalAuthHeaders(),
        signal: AbortSignal.timeout(FETCH_TIMEOUTS.meta),
      })

      if (!res.ok) {
        return fallback(`HTTP ${res.status}`)
      }

      const parsed = ListPageSchema.safeParse(await res.json())

      if (!parsed.success) {
        return fallback(`invalid response (${issueSummary(parsed.error)})`)
      }

      const pageModels = readModels(parsed.data.data)

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
      console.warn(`[pricing] skipped ${skipped} video models with unexpected fields`)
    }

    if (!isComplete) {
      const reason = `more than ${MODEL_LIST_MAX_PAGES} pages`

      console.warn(`[pricing] model list incomplete: ${reason}`)

      return { value: { models, reason }, isOk: false }
    }

    return { value: { models, reason: null }, isOk: true }
  } catch (error) {
    return fallback(messageOf(error))
  }
}

async function fetchEndpointSignal(modelId: string): Promise<TtlLoadResult<EndpointSignal>> {
  try {
    const res = await fetch(`${MODEL_URL}/${modelId}/endpoints`, {
      cache: 'no-store',
      headers: optionalAuthHeaders(),
      signal: AbortSignal.timeout(FETCH_TIMEOUTS.meta),
    })

    if (!res.ok) {
      if (res.status === 404) {
        return { value: { state: 'not_found', reason: 'HTTP 404' }, isOk: false }
      }

      return { value: { state: 'unknown', reason: `HTTP ${res.status}` }, isOk: false }
    }

    const items = endpointsOf(await res.json())

    if (isNil(items)) {
      return { value: { state: 'unknown', reason: 'invalid response' }, isOk: false }
    }

    if (items.length === 0) {
      return { value: { state: 'not_found', reason: 'no endpoints' }, isOk: false }
    }

    return { value: { state: 'present', reason: null }, isOk: true }
  } catch (error) {
    return { value: { state: 'unknown', reason: messageOf(error) }, isOk: false }
  }
}

interface ReadModelsResult {
  models: VideoModel[]
  skipped: number
}

/** One bad entry only drops that entry, never the whole list. */
function readModels(items: readonly unknown[]): ReadModelsResult {
  const models: VideoModel[] = []
  let skipped = 0

  for (const item of items) {
    const parsed = VideoModelSchema.safeParse(item)

    if (parsed.success) {
      models.push(parsed.data)
    } else {
      skipped += 1
    }
  }

  return { models, skipped }
}

function fallback(reason: string): TtlLoadResult<VideoModelsResult> {
  return { value: { models: [], reason }, isOk: false }
}

/** Clears the model list cache when keys change. */
export function registerVideoModelsSecretsListener(): void {
  registerSecretsListener('video-models', () => {
    cache.clear()
    endpointsCache.clear()
  })
}
