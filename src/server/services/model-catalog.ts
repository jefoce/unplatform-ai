/* eslint-disable max-lines -- one catalog owns entries, drift logging and preset lookups */
import 'server-only'

import { isEmpty, isNil } from 'lodash-es'

import type { CatalogEntry, CatalogEntrySource, ModelCatalog } from '@/core/catalog'
import { MODEL_CATALOG_TTL_MS } from '@/core/constants'
import { findPreset, setRuntimeVideoPresets, VIDEO_PRESETS } from '@/core/presets'
import type { ProviderBinding } from '@/core/presets/common/binding'
import { activeBinding, primaryBinding } from '@/core/presets/common/bindings'
import { isImagePreset, isVideoPreset } from '@/core/presets/common/preset-kind'
import { findImagePreset, IMAGE_PRESETS, setRuntimeImagePresets } from '@/core/presets/image'
import type { ImagePreset } from '@/core/presets/image/types'
import type { VideoPreset } from '@/core/presets/video/types'
import type { PricingInfo } from '@/core/pricing/types'
import { providerDescriptor } from '@/core/providers/registry'

import { globalState } from '../global-state'
import { loadLivePricing } from '../pricing/live'
import { getImageProvider, getVideoProvider } from '../providers/registry'
import type { ProviderModel } from '../providers/types'
import { registerSecretsListener, secretsReady } from '../secrets'
import { createTtlCache } from '../sync/ttl-cache'
import { catalogStatus } from './catalog-status'
import { clearEndpointModelCache } from './endpoint-model-cache'
import {
  clearCustomCatalog,
  findCustomPreset,
  loadCustomCatalog,
  type PresetSource,
} from './model-catalog-custom'

interface DriftState {
  logged: Set<string>
}

const STATIC_CATALOG_SOURCE: CatalogEntrySource = {
  kind: 'openrouter',
  instanceId: 'openrouter',
  badge: null,
  workflowName: null,
  local: false,
}

const driftState = globalState<DriftState>('modelCatalogDrift', () => {
  return {
    logged: new Set<string>(),
  }
})

function isBindingConfigured(binding: ProviderBinding): boolean {
  return getVideoProvider(binding.provider).isConfigured()
}

const cache = createTtlCache<ModelCatalog>({
  key: 'modelCatalog',
  okTtlMs: MODEL_CATALOG_TTL_MS,
  failTtlMs: MODEL_CATALOG_TTL_MS,
})

/** One entry per preset, with availability from the provider model list. */
export async function getModelCatalog(): Promise<ModelCatalog> {
  return cache.get('catalog', async () => {
    const catalog = await loadCatalog()

    return { value: catalog, isOk: true }
  })
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
  const video = findPreset(presetId)

  if (!isNil(video)) {
    return { preset: video, source: STATIC_CATALOG_SOURCE }
  }

  const image = findImagePreset(presetId)

  if (!isNil(image)) {
    return { preset: image, source: STATIC_CATALOG_SOURCE }
  }

  await getModelCatalog()

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

async function loadCatalog(): Promise<ModelCatalog> {
  await secretsReady()

  const [videoEntries, imageEntries, custom] = await Promise.all([
    Promise.all(VIDEO_PRESETS.map(buildEntry)),
    Promise.all(IMAGE_PRESETS.map(buildImageEntry)),
    loadCustomCatalog(),
  ])

  const customPresets = custom.presets.map((item) => {
    return item.preset
  })

  setRuntimeVideoPresets(customPresets.filter(isVideoPreset))
  setRuntimeImagePresets(customPresets.filter(isImagePreset))

  return {
    entries: [...videoEntries, ...imageEntries, ...custom.entries],
    fetchedAt: new Date().toISOString(),
  }
}

async function buildEntry(preset: VideoPreset): Promise<CatalogEntry> {
  const binding = activeBinding(preset, isBindingConfigured)
  const provider = getVideoProvider(binding.provider)
  const pricing = await provider.getPricing(preset)
  const label = providerDescriptor(binding.provider).label
  const base = { modelId: binding.modelId, presetId: preset.id, pricing }

  const isConfigured = preset.bindings.some(isBindingConfigured)

  if (!isConfigured) {
    const reason = `Add your ${label} key in Settings.`

    return {
      ...base,
      provider: null,
      status: 'no_provider',
      reason,
      availability: { status: 'no_provider', reason },
      source: STATIC_CATALOG_SOURCE,
    }
  }

  const status = await catalogStatus({ provider, binding, label })

  if (!isNil(status.model)) {
    logDrift(preset, status.model)
  }

  return {
    ...base,
    provider: binding.provider,
    status: status.status,
    reason: status.reason,
    availability: { status: status.status, reason: status.reason },
    source: STATIC_CATALOG_SOURCE,
  }
}

/** Development-only drift report. Logs once per preset, never blocks. */
function logDrift(preset: VideoPreset, model: ProviderModel): void {
  if (process.env.NODE_ENV !== 'development' || driftState.logged.has(preset.id)) {
    return
  }

  const drifts = driftList(preset, model)

  if (isEmpty(drifts)) {
    return
  }

  driftState.logged.add(preset.id)
  console.warn(`[model-catalog] ${preset.id} drift`, drifts)
}

function driftList(preset: VideoPreset, model: ProviderModel): string[] {
  const durations = preset.duration.options ?? allDurations(preset)

  return [
    ...missing({ label: 'duration', values: durations, live: model.durations }),
    ...missing({ label: 'resolution', values: preset.resolutions, live: model.resolutions }),
    ...missing({ label: 'aspect', values: preset.aspectRatios, live: model.aspectRatios }),
    ...missing({ label: 'frame', values: framesOf(preset), live: model.frameImages }),
    ...mismatch({ label: 'audio', isValue: preset.audio.supported, isLive: model.generatesAudio }),
    ...mismatch({ label: 'seed', isValue: preset.seed, isLive: model.hasSeed }),
  ]
}

interface MissingParams {
  label: string
  values: readonly (string | number)[]
  live: readonly (string | number)[] | null
}

function missing(params: MissingParams): string[] {
  const { label, values, live } = params

  if (isNil(live)) {
    return []
  }

  return values
    .filter((item) => {
      return !live.includes(item)
    })
    .map((item) => {
      return `${label} ${item} not in live list`
    })
}

interface MismatchParams {
  label: string
  isValue: boolean
  isLive: boolean | null
}

function mismatch(params: MismatchParams): string[] {
  const { label, isValue, isLive } = params

  if (isNil(isLive) || isLive === isValue) {
    return []
  }

  return [`${label} is ${isValue} but live is ${isLive}`]
}

function framesOf(preset: VideoPreset): string[] {
  const frames: string[] = []

  if (preset.frames.start) {
    frames.push('first_frame')
  }

  if (preset.frames.end) {
    frames.push('last_frame')
  }

  return frames
}

function allDurations(preset: VideoPreset): number[] {
  const { min, max } = preset.duration

  return Array.from({ length: max - min + 1 }, (_, index) => {
    return min + index
  })
}

async function buildImageEntry(preset: ImagePreset): Promise<CatalogEntry> {
  const binding = primaryBinding(preset)
  const provider = getImageProvider(binding.provider)
  const pricing = await imagePricing(preset)
  const label = providerDescriptor(binding.provider).label
  const base = { modelId: binding.modelId, presetId: preset.id, pricing }

  const isConfigured = preset.bindings.some((item) => {
    return getImageProvider(item.provider).isConfigured()
  })

  if (!isConfigured) {
    const reason = `Add your ${label} key in Settings.`

    return {
      ...base,
      provider: null,
      status: 'no_provider',
      reason,
      availability: { status: 'no_provider', reason },
      source: STATIC_CATALOG_SOURCE,
    }
  }

  const status = await catalogStatus({ provider, binding, label })

  return {
    ...base,
    provider: binding.provider,
    status: status.status,
    reason: status.reason,
    availability: { status: status.status, reason: status.reason },
    source: STATIC_CATALOG_SOURCE,
  }
}

async function imagePricing(preset: ImagePreset): Promise<PricingInfo> {
  const binding = primaryBinding(preset)

  const live = await loadLivePricing({
    provider: binding.provider,
    kind: 'image',
    modelId: binding.modelId,
    fallback: binding.pricing.fallback,
    presetId: preset.id,
  })

  return {
    skus: live.skus,
    listSkus: live.listSkus,
    discount: live.discountPct,
    source: live.source,
    fetchedAt: new Date().toISOString(),
  }
}
