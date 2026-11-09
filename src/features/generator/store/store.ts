'use client'

import { isNil, omit } from 'lodash-es'
import { z } from 'zod'

import { normalizeForPreset } from '@/core/normalize-input'
import { DEFAULT_VIDEO_PRESET_ID, findPreset, getPreset } from '@/core/presets'
import { isCustomPresetId } from '@/core/presets/custom'
import { FrameSlotsSchema, GENERATOR_TABS } from '@/core/schemas/generation-record'
import { createDraftStore } from '@/lib/create-draft-store'

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
  aspectRatio: z.string(),
  resolution: z.string(),
  frames: FrameSlotsSchema,
  references: z.array(z.string()),
  seed: z.number().nullable(),
})

/** Reapplies the preset rules to a restored draft. */
function normalizeDraft(state: GeneratorState): Partial<GeneratorState> {
  const found = findPreset(state.presetId)

  if (isNil(found) && isCustomPresetId(state.presetId)) {
    return {}
  }

  const preset = found ?? getPreset(DEFAULT_VIDEO_PRESET_ID)

  const { input } = normalizeForPreset({
    input: inputFromState(state),
    preset,
    uploads: state.uploadsById,
  })

  const { prompt, ...rest } = input

  return {
    ...rest,
    prompts: { ...state.prompts, [input.tab]: prompt },
  }
}

export const useGeneratorStore = createDraftStore<GeneratorState, z.infer<typeof DraftSchema>>({
  name: 'unplatform-ai:draft',
  version: 3,
  schema: DraftSchema,
  create: createGeneratorState,
  partialize: (state) => {
    return omit(state, ['uploadsById', 'activeCount'])
  },
  normalize: normalizeDraft,
})
