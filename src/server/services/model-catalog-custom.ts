/* eslint-disable max-lines -- one custom catalog owns the cache, the refresh and the entry mapping */
import 'server-only'

import { isNil } from 'lodash-es'

import {
  type CatalogEntry,
  type CatalogEntrySource,
  type ModelAvailability,
  type ModelStatus,
} from '@/core/catalog'
import { CUSTOM_CHECK_TIMEOUT_MS, MODEL_CATALOG_TTL_MS } from '@/core/constants'
import { setRuntimeVideoPresets } from '@/core/presets'
import { isImagePreset, isVideoPreset } from '@/core/presets/common/preset-kind'
import { mapCustomModel } from '@/core/presets/custom/from-capabilities'
import { setRuntimeImagePresets } from '@/core/presets/image'
import type { ImagePreset } from '@/core/presets/image/types'
import type { VideoPreset } from '@/core/presets/video/types'
import type { PricingInfo } from '@/core/pricing/types'
import { type UpaiModel, UpaiModelListSchema } from '@/core/protocol/upai'
import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'

import { globalState } from '../global-state'
import { fallbackPricing } from '../pricing/live'
import { requestHeaders, requestJson } from '../providers/custom/http'
import { recordHealthFromError, recordHealthOk } from './endpoint-health'
import {
  type EndpointModelCache,
  type EndpointModelKind,
  isEndpointUnreachable,
  isModelMissing,
  listEnabledCustomEndpoints,
  markEndpointReachable,
  markEndpointUnreachable,
  readEndpointModels,
  writeEndpointModels,
} from './endpoint-model-cache'

const MISSING_REASON = 'This workflow is gone from ComfyUI.'
const UNREACHABLE_REASON = 'ComfyUI is not reachable.'

export interface PresetSource {
  preset: VideoPreset | ImagePreset
  source: CatalogEntrySource
}

export interface CustomCatalogData {
  entries: CatalogEntry[]
  presets: PresetSource[]
}

interface CustomCatalogCache extends CustomCatalogData {
  isLoaded: boolean
  loadedAtMs: number
  pending: Promise<CustomCatalogData | null> | null
  revision: number
}

interface EnsureCustomCatalogParams {
  isRefresh: boolean
}

const cache = globalState<CustomCatalogCache>('customCatalogCache', () => {
  return { entries: [], presets: [], isLoaded: false, loadedAtMs: 0, pending: null, revision: 0 }
})

interface KindCatalog {
  entries: CatalogEntry[]
  presets: PresetSource[]
}

interface KindCatalogParams {
  endpoint: CustomEndpoint
  cache: EndpointModelCache
  kind: EndpointModelKind
  models: readonly UpaiModel[]
  isUnreachable: boolean
}

interface AvailabilityParams {
  fallback: ModelAvailability
  isMissing: boolean
  isUnreachable: boolean
}

interface EntryParams {
  preset: VideoPreset | ImagePreset
  model: UpaiModel
  endpoint: CustomEndpoint
  source: CatalogEntrySource
  availability: ModelAvailability
}

interface LoadCustomCatalogParams {
  isForce: boolean
}

/** Custom presets and catalog entries from the cached model lists of enabled endpoints. */
async function loadCustomCatalog(params: LoadCustomCatalogParams): Promise<CustomCatalogData> {
  const { isForce } = params
  const presets = new Map<string, PresetSource>()

  const endpoints = await listEnabledCustomEndpoints()

  const catalogs = await Promise.all(
    endpoints.map((endpoint) => {
      return loadEndpointCatalog(endpoint, isForce)
    }),
  )

  const entries = catalogs.flatMap((catalog) => {
    return catalog.entries
  })

  for (const catalog of catalogs) {
    for (const preset of catalog.presets) {
      presets.set(preset.preset.id, preset)
    }
  }

  return { entries, presets: Array.from(presets.values()) }
}

/**
 * Cached custom entries. A cold load or a refresh awaits the load, so a settings
 * save or clear never returns empty entries. A stale cache refreshes behind.
 */
export async function ensureCustomCatalog(
  params: EnsureCustomCatalogParams,
): Promise<CustomCatalogData> {
  const { isRefresh } = params

  if (!cache.isLoaded || isRefresh) {
    const data = await loadUntilStable()

    if (!isNil(data)) {
      return data
    }

    return currentCustomCatalog()
  }

  if (isCustomCacheStale()) {
    startRefresh()
  }

  return currentCustomCatalog()
}

/** A clear during a load restarts it once, so a save never sees empty entries. */
async function loadUntilStable(): Promise<CustomCatalogData | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const data = await refreshCustomCatalog()

    if (!isNil(data)) {
      return data
    }
  }

  return null
}

function currentCustomCatalog(): CustomCatalogData {
  return { entries: cache.entries, presets: cache.presets }
}

/** Deduped custom catalog load. Never rejects; null means a clear superseded it. */
export function refreshCustomCatalog(): Promise<CustomCatalogData | null> {
  const running = cache.pending

  if (!isNil(running)) {
    return running
  }

  const revision = cache.revision

  const pending = loadCustomCatalog({ isForce: true })
    .then((data) => {
      if (cache.pending !== pending || cache.revision !== revision) {
        return null
      }

      applyCustomCatalog(data)
      cache.isLoaded = true

      return data
    })
    .catch(() => {
      // Keep the previous entries. The next request retries.
      return null
    })
    .finally(() => {
      if (cache.pending === pending) {
        cache.pending = null
      }
    })

  cache.pending = pending

  return pending
}

function startRefresh(): void {
  void refreshCustomCatalog()
}

function isCustomCacheStale(): boolean {
  return Date.now() - cache.loadedAtMs >= MODEL_CATALOG_TTL_MS
}

function applyCustomCatalog(data: CustomCatalogData): void {
  cache.entries = data.entries
  cache.presets = data.presets
  cache.loadedAtMs = Date.now()

  const presets = data.presets.map((item) => {
    return item.preset
  })

  setRuntimeVideoPresets(presets.filter(isVideoPreset))
  setRuntimeImagePresets(presets.filter(isImagePreset))
}

export function findCustomPreset(presetId: string): PresetSource | null {
  return (
    cache.presets.find((item) => {
      return item.preset.id === presetId
    }) ?? null
  )
}

export function clearCustomCatalog(): void {
  cache.entries = []
  cache.presets = []
  cache.isLoaded = false
  cache.loadedAtMs = 0
  cache.pending = null
  cache.revision += 1
}

async function loadEndpointCatalog(
  endpoint: CustomEndpoint,
  isForce: boolean,
): Promise<KindCatalog> {
  const cache = await endpointModels(endpoint, isForce)

  if (isNil(cache)) {
    return { entries: [], presets: [] }
  }

  const isUnreachable = isEndpointUnreachable(endpoint.id)

  return mergeCatalogs([
    buildKindCatalog({
      endpoint,
      cache,
      kind: 'video',
      models: cache.video,
      isUnreachable,
    }),
    buildKindCatalog({ endpoint, cache, kind: 'image', models: cache.image, isUnreachable }),
  ])
}

/** Refreshes a reached endpoint on a stale cache, and keeps the last good list on failure. */
async function endpointModels(
  endpoint: CustomEndpoint,
  isForce: boolean,
): Promise<EndpointModelCache | null> {
  const cached = await readEndpointModels(endpoint.id)

  if (!isForce && isFreshCache(cached)) {
    return cached
  }

  try {
    const [video, image] = await Promise.all([
      fetchModelList(endpoint, '/api/v1/videos/models'),
      fetchModelList(endpoint, '/api/v1/images/models'),
    ])

    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: video })
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'image', models: image })
    markEndpointReachable(endpoint.id)
    recordHealthOk(endpoint.id)

    return await readEndpointModels(endpoint.id)
  } catch (error) {
    markEndpointUnreachable(endpoint.id)
    recordHealthFromError(endpoint.id, error)

    return cached
  }
}

function isFreshCache(cache: EndpointModelCache | null): boolean {
  if (isNil(cache)) {
    return false
  }

  return Date.now() - Date.parse(cache.fetchedAt) < MODEL_CATALOG_TTL_MS
}

async function fetchModelList(
  endpoint: CustomEndpoint,
  path: string,
): Promise<readonly UpaiModel[]> {
  const payload = await requestJson({
    endpoint,
    path,
    init: { headers: requestHeaders(endpoint, false), cache: 'no-store' },
    timeoutMs: CUSTOM_CHECK_TIMEOUT_MS,
  })

  return UpaiModelListSchema.parse(payload).data
}

function mergeCatalogs(catalogs: readonly KindCatalog[]): KindCatalog {
  return {
    entries: catalogs.flatMap((catalog) => {
      return catalog.entries
    }),
    presets: catalogs.flatMap((catalog) => {
      return catalog.presets
    }),
  }
}

function buildKindCatalog(params: KindCatalogParams): KindCatalog {
  const { endpoint, cache, kind, models, isUnreachable } = params
  const entries: CatalogEntry[] = []
  const presets: PresetSource[] = []

  for (const model of models) {
    const mapped = mapCustomModel({
      endpoint,
      model,
      maxUploadBytes: endpoint.lastHealth?.maxUploadBytes ?? null,
    })

    const preset = mapped.preset

    if (isNil(preset)) {
      continue
    }

    const source = sourceFor(endpoint, model)

    const availability = availabilityFor({
      fallback: mapped.availability,
      isMissing: isModelMissing({ cache, kind, modelId: model.id }),
      isUnreachable,
    })

    entries.push(entryFor({ preset, model, endpoint, source, availability }))
    presets.push({ preset, source })
  }

  return { entries, presets }
}

function availabilityFor(params: AvailabilityParams): ModelAvailability {
  const { fallback, isMissing, isUnreachable } = params

  if (isUnreachable) {
    return { status: 'unverified', reason: UNREACHABLE_REASON }
  }

  if (isMissing) {
    return { status: 'missing', reason: MISSING_REASON }
  }

  return fallback
}

function sourceFor(endpoint: CustomEndpoint, model: UpaiModel): CatalogEntrySource {
  const priceUnit = endpoint.pricing.mode === 'perSecond' ? 'second' : 'run'

  return {
    kind: 'custom',
    instanceId: endpoint.id,
    badge: endpoint.badge,
    workflowName: model.workflow?.name ?? null,
    local: true,
    priceUnit,
  }
}

function entryFor(params: EntryParams): CatalogEntry {
  const { preset, model, endpoint, source, availability } = params
  const status: ModelStatus = availability.status

  return {
    modelId: model.id,
    presetId: preset.id,
    provider: 'custom',
    status,
    reason: availability.reason,
    pricing: pricingFor(endpoint, model),
    availability,
    source,
    preset,
  }
}

function pricingFor(endpoint: CustomEndpoint, model: UpaiModel): PricingInfo {
  const price = priceOf(endpoint, model)
  const fallback = fallbackPricing({ per_run: price })

  return {
    skus: fallback.skus,
    listSkus: fallback.listSkus,
    discount: fallback.discountPct,
    source: fallback.source,
    fetchedAt: new Date().toISOString(),
  }
}

function priceOf(endpoint: CustomEndpoint, model: UpaiModel): number {
  if (endpoint.pricing.mode === 'free') {
    return 0
  }

  if (endpoint.pricing.mode === 'model') {
    return model.pricing.per_run_usd
  }

  return endpoint.pricing.usd
}
