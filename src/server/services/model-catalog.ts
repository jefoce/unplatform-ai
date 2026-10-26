import 'server-only'

import { isEmpty, isNil } from 'lodash-es'

import type { CatalogEntry, ModelCatalog } from '@/core/catalog'
import { MODEL_PRESETS } from '@/core/presets'
import { activeBinding } from '@/core/presets/bindings'
import type { ModelPreset, ProviderBinding } from '@/core/presets/types'
import { videoProviderDescriptor } from '@/core/providers/registry'

import { globalState } from '../global-state'
import { getVideoProvider } from '../providers/registry'
import type { ProviderModel } from '../providers/types'
import { secretsReady } from '../secrets'

interface DriftState {
  logged: Set<string>
}

const driftState = globalState<DriftState>('modelCatalogDrift', () => {
  return {
    logged: new Set<string>(),
  }
})

function isBindingConfigured(binding: ProviderBinding): boolean {
  return getVideoProvider(binding.provider).isConfigured()
}

/** One entry per preset, with availability from the provider model list. */
export async function getModelCatalog(): Promise<ModelCatalog> {
  await secretsReady()

  const entries = await Promise.all(MODEL_PRESETS.map(buildEntry))

  return { entries, fetchedAt: new Date().toISOString() }
}

async function buildEntry(preset: ModelPreset): Promise<CatalogEntry> {
  const binding = activeBinding(preset, isBindingConfigured)
  const provider = getVideoProvider(binding.provider)
  const pricing = await provider.getPricing(preset)
  const label = videoProviderDescriptor(binding.provider).label
  const base = { modelId: binding.modelId, presetId: preset.id, pricing }

  const isConfigured = preset.bindings.some(isBindingConfigured)

  if (!isConfigured) {
    return {
      ...base,
      provider: null,
      status: 'no_provider',
      reason: `Add your ${label} key in Settings.`,
    }
  }

  const { models, isFresh } = await provider.listModels()

  if (!isFresh || isEmpty(models)) {
    return { ...base, provider: binding.provider, status: 'unverified', reason: null }
  }

  const model = models.find((item) => {
    return item.modelId === binding.modelId
  })

  if (isNil(model)) {
    return {
      ...base,
      provider: binding.provider,
      status: 'missing',
      reason: `Not available on ${label} right now.`,
    }
  }

  logDrift(preset, model)

  return { ...base, provider: binding.provider, status: 'available', reason: null }
}

/** Development-only drift report. Logs once per preset, never blocks. */
function logDrift(preset: ModelPreset, model: ProviderModel): void {
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

function driftList(preset: ModelPreset, model: ProviderModel): string[] {
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

function framesOf(preset: ModelPreset): string[] {
  const frames: string[] = []

  if (preset.frames.start) {
    frames.push('first_frame')
  }

  if (preset.frames.end) {
    frames.push('last_frame')
  }

  return frames
}

function allDurations(preset: ModelPreset): number[] {
  const { min, max } = preset.duration

  return Array.from({ length: max - min + 1 }, (_, index) => {
    return min + index
  })
}
