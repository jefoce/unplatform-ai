'use client'

import { isEqual, keyBy, omit, pick } from 'lodash-es'
import { toast } from 'sonner'
import type { StoreApi } from 'zustand'

import { normalizeForPreset } from '@/core/normalize-input'
import { DEFAULT_PRESET_ID, findPreset, getPreset } from '@/core/presets'
import { canonicalizePrompt, referenceSlots } from '@/core/prompt-tokens'

import type { GeneratorState } from './store-actions'
import { inputFromState } from './store-draft'
import { clampReferenceDuration } from './store-helpers'

type SetState = StoreApi<GeneratorState>['setState']

type GetState = StoreApi<GeneratorState>['getState']

type LoadActions = Pick<GeneratorState, 'loadInput' | 'normalizeLoaded'>

/** Loading a saved input and normalizing the current draft. */
export function createLoadActions(set: SetState, get: GetState): LoadActions {
  return {
    loadInput: (input, uploads) => {
      const cache = { ...get().uploadsById, ...keyBy(uploads, 'id') }
      const found = findPreset(input.presetId)
      const preset = found ?? getPreset(DEFAULT_PRESET_ID)

      if (!found) toast(`Model no longer available, switched to ${preset.title}`)

      const normalized = normalizeForPreset({ input, preset, uploads: cache }).input
      const duration = clampReferenceDuration({ input: normalized, uploads: cache, preset })

      set((state) => ({
        ...omit(normalized, 'prompt'),
        duration,
        prompts: { ...state.prompts, [input.tab]: input.prompt },
        uploadsById: cache,
      }))
    },
    normalizeLoaded: () => {
      const state = get()
      const preset = findPreset(state.presetId) ?? getPreset(DEFAULT_PRESET_ID)
      const { input } = normalizeForPreset({
        input: inputFromState(state),
        preset,
        uploads: state.uploadsById,
      })
      const duration = clampReferenceDuration({ input, uploads: state.uploadsById, preset })
      const { counts } = referenceSlots(input.references, (id) => state.uploadsById[id]?.kind)
      const references = canonicalizePrompt(state.prompts.references, counts)
      const next = omit({ ...input, duration, prompts: { ...state.prompts, references } }, 'prompt')

      if (!isEqual(pick(state, Object.keys(next)), next)) set(next)
    },
  }
}
