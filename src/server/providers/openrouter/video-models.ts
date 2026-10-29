import 'server-only'

import { z } from 'zod'

import { FETCH_TIMEOUTS, PRICING_FALLBACK_TTL_MS } from '@/core/constants'
import { messageOf } from '@/core/errors'

import { registerSecretsListener } from '../../secrets'
import { createTtlCache, type TtlLoadResult } from '../../sync/ttl-cache'
import { BASE_URL, issueSummary } from './http'

const MODELS_URL = `${BASE_URL}/api/v1/videos/models`
const LIVE_TTL_MS = 3_600_000

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

const VideoModelsSchema = z.object({ data: z.array(z.unknown()) }).loose()

/** Valid models plus the reason the list fell back to empty, if it did. */
export interface VideoModelsResult {
  models: readonly VideoModel[]
  reason: string | null
}

const cache = createTtlCache<VideoModelsResult>({
  key: 'videoModels',
  okTtlMs: LIVE_TTL_MS,
  failTtlMs: PRICING_FALLBACK_TTL_MS,
})

/** Shared list with the fallback reason kept for the pricing warning. */
export async function fetchVideoModelsResult(isForce = false): Promise<VideoModelsResult> {
  return cache.get('models', fetchModelsResult, isForce)
}

/** Shared `/videos/models` list. A failure caches an empty list for five minutes. */
export async function fetchVideoModels(isForce = false): Promise<readonly VideoModel[]> {
  const { models } = await fetchVideoModelsResult(isForce)

  return models
}

async function fetchModelsResult(): Promise<TtlLoadResult<VideoModelsResult>> {
  try {
    const res = await fetch(MODELS_URL, {
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUTS.meta),
    })

    if (!res.ok) {
      return fallback(`HTTP ${res.status}`)
    }

    const parsed = VideoModelsSchema.safeParse(await res.json())

    if (!parsed.success) {
      return fallback(`invalid response (${issueSummary(parsed.error)})`)
    }

    const { models, skipped } = readModels(parsed.data.data)

    if (skipped > 0) {
      console.warn(`[pricing] skipped ${skipped} video models with unexpected fields`)
    }

    return { value: { models, reason: null }, isOk: true }
  } catch (error) {
    return fallback(messageOf(error))
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
  })
}
