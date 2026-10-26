'use client'

import { omit } from 'lodash-es'
import { toast } from 'sonner'

import { maxDurationFor } from '@/core/duration-limits'
import { isNonEmptyString } from '@/core/guards'
import { clampDuration, normalizeForPreset } from '@/core/normalize-input'
import { findPreset, getPreset } from '@/core/presets'
import type { ModelPreset } from '@/core/presets/types'
import type { GenerationInput, GeneratorTab } from '@/core/schemas/generation-record'

import { inputFromState } from './store-draft'
import { clampReferenceDuration } from './store-helpers'
import type { GeneratorSetState, GeneratorState } from './store-state'

type DraftActions = Pick<
  GeneratorState,
  | 'setPreset'
  | 'setTab'
  | 'setPrompt'
  | 'setAudio'
  | 'setDuration'
  | 'setAspectRatio'
  | 'setResolution'
>

interface NormalizedDraftParams {
  state: GeneratorState
  preset: ModelPreset
  overrides?: Partial<GenerationInput>
}

interface NextTabStateParams {
  state: GeneratorState
  preset: ModelPreset
  tab: GeneratorTab
}

function nextTabState(params: NextTabStateParams): Partial<GeneratorState> {
  const { state, preset, tab } = params

  const isInvalid =
    state.aspectRatio === 'auto' && (tab !== 'frames' || !isNonEmptyString(state.frames.start))

  const aspectRatio = isInvalid ? preset.defaultAspectRatio : state.aspectRatio

  return {
    tab,
    aspectRatio,
    duration: clampReferenceDuration({
      input: inputFromState({ ...state, tab }),
      uploads: state.uploadsById,
      preset,
    }),
  }
}

/** Normalizes a draft to the preset, toasts the notes and drops the per-tab prompt. */
function normalizedDraft(params: NormalizedDraftParams): Partial<GeneratorState> {
  const { state, preset, overrides } = params

  const { input, notes } = normalizeForPreset({
    input: { ...inputFromState(state), ...overrides },
    preset,
    uploads: state.uploadsById,
  })

  if (notes.length > 0) {
    toast(notes.join(' \u00b7 '))
  }

  return omit(input, 'prompt')
}

/** Draft fields and their actions, kept out of the store creator. */
export function createDraftActions(set: GeneratorSetState): DraftActions {
  return {
    setPreset: (id) => {
      set((state) => {
        const preset = findPreset(id)

        if (!preset) {
          return {}
        }

        return normalizedDraft({ state, preset })
      })
    },
    setTab: (tab) => {
      set((state) => {
        return nextTabState({ state, preset: getPreset(state.presetId), tab })
      })
    },
    setPrompt: (text) => {
      set((state) => {
        return { prompts: { ...state.prompts, [state.tab]: text } }
      })
    },
    setAudio: (isAudio) => {
      set({ audio: isAudio })
    },
    setDuration: (duration) => {
      set((state) => {
        const preset = getPreset(state.presetId)

        const limit = maxDurationFor({
          input: inputFromState(state),
          uploads: state.uploadsById,
          preset,
        })

        return { duration: clampDuration({ value: duration, preset, limit }) }
      })
    },
    setAspectRatio: (aspectRatio) => {
      set((state) => {
        if (aspectRatio !== 'auto') {
          return { aspectRatio }
        }

        const preset = getPreset(state.presetId)

        const isAllowed =
          state.tab === 'frames' && Boolean(state.frames.start) && preset.autoAspectWithFrames

        const nextAspectRatio = isAllowed ? aspectRatio : preset.defaultAspectRatio

        return { aspectRatio: nextAspectRatio }
      })
    },
    setResolution: (resolution) => {
      set((state) => {
        return normalizedDraft({
          state,
          preset: getPreset(state.presetId),
          overrides: { resolution },
        })
      })
    },
  }
}
