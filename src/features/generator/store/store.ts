'use client'

import { isNil, omit } from 'lodash-es'
import { z } from 'zod'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { normalizeForPreset } from '@/core/normalize-input'
import { DEFAULT_PRESET_ID, findPreset, getPreset } from '@/core/presets'
import { ASPECT_RATIOS, RESOLUTIONS } from '@/core/presets/types'
import { FrameSlotsSchema, GENERATOR_TABS } from '@/core/schemas/generation-record'

import { createGeneratorState } from './store-actions'
import { inputFromState } from './store-draft'
import type { GeneratorState } from './store-state'

const PromptMapSchema = z.object({ frames: z.string(), references: z.string() })

const DraftSchema = z.object({
  presetId: z.string(),
  tab: z.enum(GENERATOR_TABS),
  prompts: PromptMapSchema,
  audio: z.boolean(),
  duration: z.number(),
  aspectRatio: z.enum([...ASPECT_RATIOS, 'auto']),
  resolution: z.enum(RESOLUTIONS),
  frames: FrameSlotsSchema,
  references: z.array(z.string()),
  seed: z.number().nullable(),
})

/** Normalizes the restored draft to the preset once persistence finishes. */
function rehydrate(state?: GeneratorState): void {
  if (isNil(state)) {
    return
  }

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
    partialize: (state) => {
      return omit(state, ['uploadsById', 'activeCount'])
    },
    merge: (persisted, current) => {
      const parsed = DraftSchema.safeParse(persisted)

      if (!parsed.success) {
        return current
      }

      return { ...current, ...parsed.data }
    },
    migrate: (persisted) => {
      return persisted
    },
    onRehydrateStorage: () => {
      return rehydrate
    },
  }),
)
