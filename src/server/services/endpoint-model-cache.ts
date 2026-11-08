/* eslint-disable max-lines -- one cache owns both kinds, their pruning and the missing window */

import 'server-only'

import path from 'node:path'

import { isNil } from 'lodash-es'
import { z } from 'zod'

import { CUSTOM_MISSING_KEEP_DAYS } from '@/core/constants'
import { type UpaiModel, UpaiModelSchema } from '@/core/protocol/upai'
import { type CustomEndpoint, CustomEndpointFileSchema } from '@/core/schemas/custom-endpoint'

import { readJson, removeFile, writeJsonAtomic } from '../fs/json-file'
import { globalState } from '../global-state'
import { STORAGE_ROOT } from '../paths'
import { getEndpointSync } from '../providers/custom/endpoint-source'
import { withLock } from '../sync/lock'

export type EndpointModelKind = 'video' | 'image'

const DATA_DIR = path.join(STORAGE_ROOT, 'data')
const ENDPOINTS_FILE = path.join(DATA_DIR, 'endpoints.json')
const MODELS_DIR = path.join(DATA_DIR, 'endpoint-models')
const ENDPOINT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
const MS_PER_DAY = 24 * 60 * 60 * 1000

const EndpointModelCacheSchema = z
  .object({
    fetchedAt: z.string(),
    video: z.array(UpaiModelSchema).default([]),
    image: z.array(UpaiModelSchema).default([]),
    missingSince: z.record(z.string(), z.string()).default({}),
  })
  .loose()

type EndpointModelCacheFile = z.infer<typeof EndpointModelCacheSchema>

export interface EndpointModelCache {
  fetchedAt: string
  video: readonly UpaiModel[]
  image: readonly UpaiModel[]
  missingSince: Readonly<Record<string, string>>
}

interface CacheState {
  files: Map<string, EndpointModelCacheFile | null>
  unreachable: Set<string>
}

interface WriteEndpointModelsParams {
  endpointId: string
  kind: EndpointModelKind
  models: readonly UpaiModel[]
}

const state = globalState<CacheState>('endpointModelCache', () => {
  return { files: new Map(), unreachable: new Set() }
})

/** Enabled endpoints only, read straight from data/endpoints.json. */
export async function listEnabledCustomEndpoints(): Promise<CustomEndpoint[]> {
  const file = await readJson(ENDPOINTS_FILE, CustomEndpointFileSchema)

  const enabled = (file?.endpoints ?? []).filter((endpoint) => {
    return endpoint.enabled && isSafeEndpointId(endpoint.id)
  })

  const enabledIds = new Set(
    enabled.map((endpoint) => {
      return endpoint.id
    }),
  )

  for (const endpointId of Array.from(state.files.keys())) {
    if (!enabledIds.has(endpointId)) {
      state.files.delete(endpointId)
    }
  }

  return enabled
}

/** Raw cached models, with expired missing entries dropped. */
export async function readEndpointModels(endpointId: string): Promise<EndpointModelCache | null> {
  const file = await readCacheFile(endpointId)

  return presentCache(file)
}

export async function writeEndpointModels(params: WriteEndpointModelsParams): Promise<void> {
  const { endpointId, kind, models } = params

  if (!isSafeEndpointId(endpointId)) {
    throw new Error(`Invalid endpoint id: ${endpointId}`)
  }

  await withLock(`endpoint-models:${endpointId}`, async () => {
    if (isNil(getEndpointSync(endpointId))) {
      return
    }

    const nextFile = nextCacheFile({ previous: await readCacheFile(endpointId), kind, models })

    await writeJsonAtomic({ file: fileFor(endpointId), data: nextFile })
    state.files.set(endpointId, nextFile)
    markEndpointReachable(endpointId)
  })
}

interface NextCacheFileParams {
  previous: EndpointModelCacheFile | null
  kind: EndpointModelKind
  models: readonly UpaiModel[]
}

function nextCacheFile(params: NextCacheFileParams): EndpointModelCacheFile {
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

export async function removeEndpointModelCache(endpointId: string): Promise<void> {
  if (!isSafeEndpointId(endpointId)) {
    return
  }

  await withLock(`endpoint-models:${endpointId}`, async () => {
    await removeFile(fileFor(endpointId))
    state.files.delete(endpointId)
    state.unreachable.delete(endpointId)
  })
}

/** Drops memory only. Files stay, so the next read reloads them. */
export function clearEndpointModelCache(): void {
  state.files.clear()
  state.unreachable.clear()
}

export function markEndpointUnreachable(endpointId: string): void {
  state.unreachable.add(endpointId)
}

export function markEndpointReachable(endpointId: string): void {
  state.unreachable.delete(endpointId)
}

export function isEndpointUnreachable(endpointId: string): boolean {
  return state.unreachable.has(endpointId)
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

async function readCacheFile(endpointId: string): Promise<EndpointModelCacheFile | null> {
  if (!isSafeEndpointId(endpointId)) {
    return null
  }

  if (state.files.has(endpointId)) {
    return state.files.get(endpointId) ?? null
  }

  const file = await readJson(fileFor(endpointId), EndpointModelCacheSchema)

  state.files.set(endpointId, file)

  return file
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

function presentCache(file: EndpointModelCacheFile | null): EndpointModelCache | null {
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

function fileFor(endpointId: string): string {
  return path.join(MODELS_DIR, `${endpointId}.json`)
}

function isSafeEndpointId(endpointId: string): boolean {
  return ENDPOINT_ID_PATTERN.test(endpointId)
}
