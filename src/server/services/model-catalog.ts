import 'server-only'

import { isNil } from 'lodash-es'

import type { CatalogEntry, ModelCatalog } from '@/core/catalog'
import { MODEL_CATALOG_TTL_MS } from '@/core/constants'
import { findPreset, setRuntimeVideoPresets } from '@/core/presets'
import { isImagePreset, isVideoPreset } from '@/core/presets/common/preset-kind'
import { isCustomPresetId } from '@/core/presets/custom'
import { findImagePreset, setRuntimeImagePresets } from '@/core/presets/image'
import type { ImagePreset } from '@/core/presets/image/types'
import type { VideoPreset } from '@/core/presets/video/types'

import { registerSecretsListener } from '../secrets'
import { createTtlCache } from '../sync/ttl-cache'
import { clearEndpointModelCache } from './endpoint-model-cache'
import {
  clearCustomCatalog,
  ensureCustomCatalog,
  findCustomPreset,
  refreshCustomCatalog,
} from './model-catalog-custom'
import type { PresetSource } from './model-catalog-custom-entries'
import { loadStaticEntries, STATIC_CATALOG_SOURCE } from './model-catalog-static'

const cache = createTtlCache<CatalogEntry[]>({
  key: 'modelCatalogStatic',
  okTtlMs: MODEL_CATALOG_TTL_MS,
  failTtlMs: MODEL_CATALOG_TTL_MS,
})

interface GetModelCatalogParams {
  isRefreshCustom?: boolean
}

/** Static entries from the TTL cache next to the cached custom entries. */
export async function getModelCatalog(params: GetModelCatalogParams = {}): Promise<ModelCatalog> {
  const { isRefreshCustom = false } = params

  const [entries, custom] = await Promise.all([
    cache.get('static', loadStaticEntries),
    ensureCustomCatalog({ isRefresh: isRefreshCustom }),
  ])

  return {
    entries: [...entries, ...custom.entries],
    fetchedAt: new Date().toISOString(),
  }
}

/** Drops the cached catalog and custom model memory after settings change. */
export function clearModelCatalog(): void {
  cache.clear()
  clearCustomCatalog()
  clearEndpointModelCache()
  setRuntimeVideoPresets([])
  setRuntimeImagePresets([])
}

/** Drops the cached catalog when any key changes. */
export function registerModelCatalogSecretsListener(): void {
  registerSecretsListener('model-catalog', () => {
    clearModelCatalog()
  })
}

/** Catalog-aware preset lookup for submit, regenerate and reuse. */
export async function findPresetAny(presetId: string): Promise<PresetSource | null> {
  if (isCustomPresetId(presetId)) {
    return findCustomPresetAfterRefresh(presetId)
  }

  const video = findPreset(presetId)

  if (!isNil(video)) {
    return { preset: video, source: STATIC_CATALOG_SOURCE }
  }

  const image = findImagePreset(presetId)

  if (!isNil(image)) {
    return { preset: image, source: STATIC_CATALOG_SOURCE }
  }

  return null
}

/** Checks the custom index first, then refreshes once before giving up. */
async function findCustomPresetAfterRefresh(presetId: string): Promise<PresetSource | null> {
  const cached = findCustomPreset(presetId)

  if (!isNil(cached)) {
    return cached
  }

  const data = await refreshCustomCatalog()

  if (isNil(data)) {
    await refreshCustomCatalog()
  }

  return findCustomPreset(presetId)
}

/** Catalog-aware video lookup. Returns null for an image preset or an unknown id. */
export async function findVideoPresetAny(presetId: string): Promise<VideoPreset | null> {
  const found = await findPresetAny(presetId)

  if (isNil(found) || !isVideoPreset(found.preset)) {
    return null
  }

  return found.preset
}

/** Catalog-aware image lookup. Returns null for a video preset or an unknown id. */
export async function findImagePresetAny(presetId: string): Promise<ImagePreset | null> {
  const found = await findPresetAny(presetId)

  if (isNil(found) || !isImagePreset(found.preset)) {
    return null
  }

  return found.preset
}
