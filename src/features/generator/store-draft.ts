import { DEFAULT_PRESET_ID, getPreset } from '@/core/presets'
import type { GenerationInput, GeneratorTab } from '@/core/types'

type PromptMap = Record<GeneratorTab, string>

export type GeneratorDraft = Omit<GenerationInput, 'prompt'> & { prompts: PromptMap }

/** Active mode prompt. */
export const promptFor = (state: Pick<GeneratorDraft, 'prompts' | 'tab'>): string =>
  state.prompts[state.tab]

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
  const preset = getPreset(DEFAULT_PRESET_ID)

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
