import 'server-only'

import { isNil } from 'lodash-es'

import {
  type CatalogEntry,
  type CatalogEntrySource,
  type ModelAvailability,
  type ModelStatus,
} from '@/core/catalog'
import { FETCH_TIMEOUTS, MODEL_CATALOG_TTL_MS } from '@/core/constants'
import { mapCustomModel } from '@/core/presets/custom/from-capabilities'
import type { ImagePreset } from '@/core/presets/image/types'
import type { VideoPreset } from '@/core/presets/video/types'
import type { PricingInfo } from '@/core/pricing/types'
import { type UpaiModel, UpaiModelListSchema } from '@/core/protocol/upai'
import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'

import { globalState } from '../global-state'
import { fallbackPricing } from '../pricing/live'
import { requestHeaders, requestJson } from '../providers/custom/http'
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

const presetIndex = globalState<Map<string, PresetSource>>('customPresetIndex', () => {
  return new Map()
})

export interface PresetSource {
  preset: VideoPreset | ImagePreset
  source: CatalogEntrySource
}

export interface CustomCatalogData {
  entries: CatalogEntry[]
  presets: PresetSource[]
}

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

/** Custom presets and catalog entries from the cached model lists of enabled endpoints. */
export async function loadCustomCatalog(): Promise<CustomCatalogData> {
  presetIndex.clear()

  const endpoints = await listEnabledCustomEndpoints()

  const catalogs = await Promise.all(
    endpoints.map((endpoint) => {
      return loadEndpointCatalog(endpoint)
    }),
  )

  const entries = catalogs.flatMap((catalog) => {
    return catalog.entries
  })

  for (const catalog of catalogs) {
    for (const preset of catalog.presets) {
      presetIndex.set(preset.preset.id, preset)
    }
  }

  return { entries, presets: Array.from(presetIndex.values()) }
}

export function findCustomPreset(presetId: string): PresetSource | null {
  return presetIndex.get(presetId) ?? null
}

export function clearCustomCatalog(): void {
  presetIndex.clear()
}

async function loadEndpointCatalog(endpoint: CustomEndpoint): Promise<KindCatalog> {
  const cache = await endpointModels(endpoint)

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
async function endpointModels(endpoint: CustomEndpoint): Promise<EndpointModelCache | null> {
  const cached = await readEndpointModels(endpoint.id)

  if (isNil(endpoint.lastHealth) || isFreshCache(cached)) {
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

    return await readEndpointModels(endpoint.id)
  } catch {
    markEndpointUnreachable(endpoint.id)

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
    timeoutMs: FETCH_TIMEOUTS.meta,
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
  return {
    kind: 'custom',
    instanceId: endpoint.id,
    badge: endpoint.badge,
    workflowName: model.workflow?.name ?? null,
    local: true,
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
