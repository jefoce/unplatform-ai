import { DEFAULT_VIDEO_PRESET_ID, getPreset } from '@/core/presets'
import type { GenerationInput, GeneratorTab } from '@/core/schemas/generation-record'

type PromptMap = Record<GeneratorTab, string>

export interface GeneratorDraft extends Omit<GenerationInput, 'prompt'> {
  prompts: PromptMap
}

/** Plain GenerationInput snapshot of the draft, without actions or upload cache. */
export function inputFromState(state: GeneratorDraft): GenerationInput {
  return {
    presetId: state.presetId,
    tab: state.tab,
    prompt: state.prompts[state.tab],
    audio: state.audio,
    duration: state.duration,
    aspectRatio: state.aspectRatio,
    resolution: state.resolution,
    frames: { ...state.frames },
    references: [...state.references],
    seed: state.seed,
  }
}

/** Default draft for the default preset. */
export function defaults(): GeneratorDraft {
  const preset = getPreset(DEFAULT_VIDEO_PRESET_ID)

  return {
    presetId: preset.id,
    tab: 'frames',
    prompts: { frames: '', references: '' },
    audio: preset.audio.default,
    duration: preset.duration.default,
    aspectRatio: preset.defaultAspectRatio,
    resolution: preset.defaultResolution,
    frames: { start: null, end: null },
    references: [],
    seed: null,
  }
}
