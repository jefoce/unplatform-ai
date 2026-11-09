import 'server-only'

import { isNil } from 'lodash-es'

import type { CatalogEntry } from '@/core/catalog'
import { CUSTOM_CATALOG_MIN_REFRESH_MS, MODEL_CATALOG_TTL_MS } from '@/core/constants'
import { setRuntimeVideoPresets } from '@/core/presets'
import { isImagePreset, isVideoPreset } from '@/core/presets/common/preset-kind'
import { setRuntimeImagePresets } from '@/core/presets/image'

import { isCustomEndpointMockMode } from '../config/mock-mode'
import { globalState } from '../global-state'
import {
  customMockCatalogForInstance,
  customMockEndpoint,
  customMockInstances,
} from '../providers/mock/custom-mock'
import { secretsReady } from '../secrets'
import { listEnabledCustomEndpoints } from './endpoint-model-cache'
import {
  catalogFromModels,
  type KindCatalog,
  loadEndpointCatalog,
  type PresetSource,
} from './model-catalog-custom-entries'

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
  isForce?: boolean
}

interface LoadCustomCatalogParams {
  isForce: boolean
}

const cache = globalState<CustomCatalogCache>('customCatalogCache', () => {
  return { entries: [], presets: [], isLoaded: false, loadedAtMs: 0, pending: null, revision: 0 }
})

/** Custom presets and catalog entries from the cached model lists of enabled endpoints. */
async function loadCustomCatalog(params: LoadCustomCatalogParams): Promise<CustomCatalogData> {
  const { isForce } = params
  let catalogs: KindCatalog[]

  if (isCustomEndpointMockMode()) {
    catalogs = mockCatalogs()
  } else {
    catalogs = await liveCatalogs(isForce)
  }

  return mergeCustomCatalogs(catalogs)
}

function mockCatalogs(): KindCatalog[] {
  return customMockInstances().map((instance) => {
    const catalog = customMockCatalogForInstance(instance.id)

    return catalogFromModels({
      endpoint: customMockEndpoint(instance),
      video: catalog.video,
      image: catalog.image,
      isUnreachable: !catalog.isReachable,
    })
  })
}

async function liveCatalogs(isForce: boolean): Promise<KindCatalog[]> {
  await secretsReady()

  const endpoints = await listEnabledCustomEndpoints()

  return Promise.all(
    endpoints.map((endpoint) => {
      return loadEndpointCatalog(endpoint, isForce)
    }),
  )
}

function mergeCustomCatalogs(catalogs: readonly KindCatalog[]): CustomCatalogData {
  const presets = new Map<string, PresetSource>()

  for (const catalog of catalogs) {
    for (const preset of catalog.presets) {
      presets.set(preset.preset.id, preset)
    }
  }

  return {
    entries: catalogs.flatMap((catalog) => {
      return catalog.entries
    }),
    presets: Array.from(presets.values()),
  }
}

/**
 * Cached custom entries. A cold load or a refresh awaits the load, so a settings
 * save or clear never returns empty entries. A stale cache refreshes behind.
 * An automatic refresh skips a cache younger than the minimum gap. A forced one does not.
 */
export async function ensureCustomCatalog(
  params: EnsureCustomCatalogParams,
): Promise<CustomCatalogData> {
  const { isRefresh, isForce = false } = params

  if (isRefresh && !isForce && cache.isLoaded && isCustomCacheYoung()) {
    return currentCustomCatalog()
  }

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

function isCustomCacheYoung(): boolean {
  return Date.now() - cache.loadedAtMs < CUSTOM_CATALOG_MIN_REFRESH_MS
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
