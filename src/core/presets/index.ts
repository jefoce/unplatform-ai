import { primaryBinding } from './common/bindings'
import { SEEDANCE_20 } from './video/seedance/seedance-2.0'
import { SEEDANCE_25 } from './video/seedance/seedance-2.5'
import type { VideoPreset } from './video/types'
import { WAN_30 } from './video/wan/wan-3.0'
import { WAN_30_PRIME } from './video/wan/wan-3.0-prime'

export const VIDEO_PRESETS = [
  WAN_30,
  WAN_30_PRIME,
  SEEDANCE_20,
  SEEDANCE_25,
] as const satisfies readonly VideoPreset[]

export const DEFAULT_VIDEO_PRESET_ID = 'wan-3.0'

const runtimePresets = new Map<string, VideoPreset>()

/** Runtime presets from the model catalog, replaced on every catalog refresh. */
export function setRuntimeVideoPresets(presets: readonly VideoPreset[]): void {
  runtimePresets.clear()

  for (const preset of presets) {
    runtimePresets.set(preset.id, preset)
  }
}

export const findPreset = (id: string): VideoPreset | null => {
  return (
    VIDEO_PRESETS.find((preset) => {
      return preset.id === id
    }) ??
    runtimePresets.get(id) ??
    null
  )
}

/** Display fallback only. Submissions must use findPreset. */
export const getPreset = (id: string): VideoPreset => {
  return findPreset(id) ?? VIDEO_PRESETS[0]
}

/** Shortest duration to submit: the provider minimum raised to the billing floor. */
export const minDuration = (preset: VideoPreset): number => {
  return Math.max(preset.duration.min, primaryBinding(preset).pricing.minBillableSec ?? 0)
}
