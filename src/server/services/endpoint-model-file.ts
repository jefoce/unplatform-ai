import 'server-only'

import { isNil } from 'lodash-es'
import { z } from 'zod'

import { CUSTOM_MISSING_KEEP_DAYS } from '@/core/constants'
import { type UpaiModel, UpaiModelSchema } from '@/core/protocol/upai'

export type EndpointModelKind = 'video' | 'image'

const ENDPOINT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
const MS_PER_DAY = 24 * 60 * 60 * 1000

export const EndpointModelCacheSchema = z
  .object({
    fetchedAt: z.string(),
    video: z.array(UpaiModelSchema).default([]),
    image: z.array(UpaiModelSchema).default([]),
    missingSince: z.record(z.string(), z.string()).default({}),
  })
  .loose()

export type EndpointModelCacheFile = z.infer<typeof EndpointModelCacheSchema>

export interface EndpointModelCache {
  fetchedAt: string
  video: readonly UpaiModel[]
  image: readonly UpaiModel[]
  missingSince: Readonly<Record<string, string>>
}

interface NextCacheFileParams {
  previous: EndpointModelCacheFile | null
  kind: EndpointModelKind
  models: readonly UpaiModel[]
}

export function nextCacheFile(params: NextCacheFileParams): EndpointModelCacheFile {
  const { previous, kind, models } = params
  const now = new Date()
  const nowIso = now.toISOString()
  const cutoff = now.getTime() - keepMs()
  const missingSince = { ...(previous?.missingSince ?? {}) }
  let video = previous?.video ?? []
  let image = previous?.image ?? []

  if (kind === 'video') {
    video = mergeKind({ kind, previous: video, models, missingSince, nowIso })
  }

  if (kind === 'image') {
    image = mergeKind({ kind, previous: image, models, missingSince, nowIso })
  }

  return {
    fetchedAt: nowIso,
    video: pruneKind({ models: video, kind: 'video', missingSince, cutoff }),
    image: pruneKind({ models: image, kind: 'image', missingSince, cutoff }),
    missingSince,
  }
}

interface ModelMissingParams {
  cache: EndpointModelCache
  kind: EndpointModelKind
  modelId: string
}

export function isModelMissing(params: ModelMissingParams): boolean {
  const { cache, kind, modelId } = params

  return !isNil(cache.missingSince[missingKey(kind, modelId)])
}

interface MergeKindParams {
  kind: EndpointModelKind
  previous: readonly UpaiModel[]
  models: readonly UpaiModel[]
  missingSince: Record<string, string>
  nowIso: string
}

function mergeKind(params: MergeKindParams): UpaiModel[] {
  const { kind, previous, models, missingSince, nowIso } = params

  const fetchedIds = new Set(
    models.map((model) => {
      return model.id
    }),
  )

  const next = [...models]

  for (const id of fetchedIds) {
    delete missingSince[missingKey(kind, id)]
  }

  for (const model of previous) {
    if (fetchedIds.has(model.id)) {
      continue
    }

    const key = missingKey(kind, model.id)

    missingSince[key] ??= nowIso
    next.push(model)
  }

  return next
}

interface PruneKindParams {
  models: readonly UpaiModel[]
  kind: EndpointModelKind
  missingSince: Record<string, string>
  cutoff: number
}

function pruneKind(params: PruneKindParams): UpaiModel[] {
  const { models, kind, missingSince, cutoff } = params

  return models.filter((model) => {
    const key = missingKey(kind, model.id)

    if (!isExpired(missingSince[key], cutoff)) {
      return true
    }

    delete missingSince[key]

    return false
  })
}

export function presentCache(file: EndpointModelCacheFile | null): EndpointModelCache | null {
  if (isNil(file)) {
    return null
  }

  const cutoff = Date.now() - keepMs()

  return {
    fetchedAt: file.fetchedAt,
    video: presentModels({
      models: file.video,
      kind: 'video',
      missingSince: file.missingSince,
      cutoff,
    }),
    image: presentModels({
      models: file.image,
      kind: 'image',
      missingSince: file.missingSince,
      cutoff,
    }),
    missingSince: presentMissing(file.missingSince, cutoff),
  }
}

interface PresentModelsParams {
  models: readonly UpaiModel[]
  kind: EndpointModelKind
  missingSince: Readonly<Record<string, string>>
  cutoff: number
}

function presentModels(params: PresentModelsParams): readonly UpaiModel[] {
  const { models, kind, missingSince, cutoff } = params

  return models.filter((model) => {
    return !isExpired(missingSince[missingKey(kind, model.id)], cutoff)
  })
}

function presentMissing(
  missingSince: Readonly<Record<string, string>>,
  cutoff: number,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(missingSince).filter(([, since]) => {
      return !isExpired(since, cutoff)
    }),
  )
}

function isExpired(since: string | undefined, cutoff: number): boolean {
  if (isNil(since)) {
    return false
  }

  const time = Date.parse(since)

  return !Number.isFinite(time) || time < cutoff
}

function keepMs(): number {
  return CUSTOM_MISSING_KEEP_DAYS * MS_PER_DAY
}

function missingKey(kind: EndpointModelKind, modelId: string): string {
  return `${kind}:${modelId}`
}

export function isSafeEndpointId(endpointId: string): boolean {
  return ENDPOINT_ID_PATTERN.test(endpointId)
}
