import { SEEDANCE_20 } from './seedance/seedance-2.0'
import { SEEDANCE_25 } from './seedance/seedance-2.5'
import type { ModelPreset } from './types'
import { WAN_30 } from './wan/wan-3.0'
import { WAN_30_PRIME } from './wan/wan-3.0-prime'

export * from './types'

export const MODEL_PRESETS = [
  WAN_30,
  WAN_30_PRIME,
  SEEDANCE_20,
  SEEDANCE_25,
] as const satisfies readonly ModelPreset[]

export const DEFAULT_PRESET_ID = 'wan-3.0'

export const findPreset = (id: string): ModelPreset | null =>
  MODEL_PRESETS.find((preset) => preset.id === id) ?? null

/** Display fallback only. Submissions must use findPreset. */
export const getPreset = (id: string): ModelPreset => findPreset(id) ?? MODEL_PRESETS[0]

/** Shortest duration to submit: the provider minimum raised to the billing floor. */
export const minDuration = (preset: ModelPreset): number =>
  Math.max(preset.duration.min, preset.minBillableSec ?? preset.duration.min)
