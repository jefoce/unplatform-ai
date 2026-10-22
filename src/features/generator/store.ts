'use client'

import { isNil, omit } from 'lodash-es'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { normalizeForPreset } from '@/core/normalize-input'
import { DEFAULT_PRESET_ID, findPreset, getPreset } from '@/core/presets'

import { createGeneratorState, type GeneratorState } from './store-actions'
import { defaults, inputFromState } from './store-draft'

export type { GeneratorState } from './store-actions'
export { inputFromState, promptFor } from './store-draft'
export { randomSeed, slotCounts, uploadForSlot } from './store-helpers'

/** Normalizes the restored draft to the preset once persistence finishes. */
function rehydrate(state?: GeneratorState): void {
  if (isNil(state)) return

  queueMicrotask(() => {
    const current = useGeneratorStore.getState()
    const preset = findPreset(current.presetId) ?? getPreset(DEFAULT_PRESET_ID)
    const { input } = normalizeForPreset({
      input: inputFromState(current),
      preset,
      uploads: current.uploadsById,
    })
    const { prompt, ...rest } = input

    useGeneratorStore.setState({
      ...rest,
      prompts: { ...current.prompts, [input.tab]: prompt },
    })
  })
}

export const useGeneratorStore = create<GeneratorState>()(
  persist(createGeneratorState, {
    name: 'unplatform-ai:draft',
    version: 3,
    partialize: (state) => omit(state, ['uploadsById', 'activeCount']),
    migrate: () => defaults() as unknown as GeneratorState,
    onRehydrateStorage: () => rehydrate,
  }),
)
