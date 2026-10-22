'use client'

import { clamp, isNil, keyBy, omit } from 'lodash-es'
import { toast } from 'sonner'
import type { StateCreator } from 'zustand'

import { SEED_MAX } from '@/core/constants'
import { clampDuration, normalizeForPreset } from '@/core/normalize-input'
import { findPreset, getPreset, type ModelPreset } from '@/core/presets'
import type { RefSlot } from '@/core/prompt-tokens'
import type { GenerationInput, GeneratorTab, UploadItem } from '@/core/types'
import { maxDurationFor } from '@/core/validation'

import { defaults, type GeneratorDraft, inputFromState } from './store-draft'
import { createFrameActions } from './store-frame-actions'
import { clampReferenceDuration, randomSeed } from './store-helpers'
import { createLoadActions } from './store-load-actions'
import { createReferenceActions } from './store-reference-actions'

type MentionInserter = (slot: RefSlot) => void

type SlotFocuser = (slot: RefSlot, occurrence: number) => void
let mentionInserter: MentionInserter | null = null
let slotFocuser: SlotFocuser | null = null

function clampSeed(seed: number | null): number | null {
  if (isNil(seed)) return null

  return clamp(Math.round(seed), 0, SEED_MAX)
}

export interface GeneratorState extends GeneratorDraft {
  uploadsById: Record<string, UploadItem>
  activeCount: number
  setActiveCount: (count: number) => void
  setPreset: (id: string) => void
  setTab: (tab: GeneratorTab) => void
  setPrompt: (text: string) => void
  setAudio: (audio: boolean) => void
  setDuration: (duration: number) => void
  setAspectRatio: (aspectRatio: GenerationInput['aspectRatio']) => void
  setResolution: (resolution: GenerationInput['resolution']) => void
  setFrame: (slot: 'start' | 'end', upload: UploadItem | null) => void
  addReferences: (uploads: UploadItem[]) => void
  replaceReference: (id: string, upload: UploadItem) => void
  removeReference: (id: string) => void
  insertMention: (slot: RefSlot) => void
  focusSlot: (slot: RefSlot, occurrence: number) => void
  setSeed: (seed: number | null) => void
  toggleSeedLock: () => void
  loadInput: (input: GenerationInput, uploads: UploadItem[]) => void
  normalizeLoaded: () => void
  reset: () => void
  registerMentionInserter: (fn: MentionInserter | null) => void
  registerSlotFocuser: (fn: SlotFocuser | null) => void
  upsertUploads: (uploads: UploadItem[]) => void
}

interface NormalizedDraftParams {
  state: GeneratorState
  preset: ModelPreset
  overrides?: Partial<GenerationInput>
}

/** Normalizes a draft to the preset, toasts the notes and drops the per-tab prompt. */
function normalizedDraft(params: NormalizedDraftParams): Partial<GeneratorState> {
  const { state, preset, overrides } = params
  const { input, notes } = normalizeForPreset({
    input: { ...inputFromState(state), ...overrides },
    preset,
    uploads: state.uploadsById,
  })

  if (notes.length > 0) toast(notes.join(' \u00b7 '))

  return omit(input, 'prompt')
}

/** Draft state and its actions, wired to persist by store.ts. */
export const createGeneratorState: StateCreator<
  GeneratorState,
  [['zustand/persist', unknown]],
  []
> = (set, get) => ({
  ...defaults(),
  uploadsById: {},
  activeCount: 0,
  setActiveCount: (activeCount) => set({ activeCount }),
  setPreset: (id) =>
    set((state) => {
      const preset = findPreset(id)

      if (!preset) return {}

      return normalizedDraft({ state, preset })
    }),
  setTab: (tab) =>
    set((state) => {
      const preset = getPreset(state.presetId)
      const isInvalid =
        state.aspectRatio === 'auto' &&
        (tab !== 'frames' || isNil(state.frames.start) || state.frames.start === '')

      return {
        tab,
        aspectRatio: isInvalid ? preset.defaultAspectRatio : state.aspectRatio,
        duration: clampReferenceDuration({
          input: inputFromState({ ...state, tab }),
          uploads: state.uploadsById,
          preset,
        }),
      }
    }),
  setPrompt: (text) => set((state) => ({ prompts: { ...state.prompts, [state.tab]: text } })),
  setAudio: (isAudio) => set({ audio: isAudio }),
  setDuration: (duration) =>
    set((state) => {
      const preset = getPreset(state.presetId)
      const limit = maxDurationFor({
        input: inputFromState(state),
        uploads: state.uploadsById,
        preset,
      })

      return { duration: clampDuration({ value: duration, preset, limit }) }
    }),
  setAspectRatio: (aspectRatio) =>
    set((state) => {
      if (aspectRatio !== 'auto') return { aspectRatio }

      const preset = getPreset(state.presetId)
      const isAllowed =
        state.tab === 'frames' && Boolean(state.frames.start) && preset.autoAspectWithFrames

      return { aspectRatio: isAllowed ? aspectRatio : preset.defaultAspectRatio }
    }),
  setResolution: (resolution) =>
    set((state) =>
      normalizedDraft({ state, preset: getPreset(state.presetId), overrides: { resolution } }),
    ),
  ...createFrameActions(set),
  ...createReferenceActions(set),
  insertMention: (slot) => mentionInserter?.(slot),
  focusSlot: (slot, occurrence) => slotFocuser?.(slot, occurrence),
  setSeed: (seed) => set({ seed: clampSeed(seed) }),
  toggleSeedLock: () => set((state) => ({ seed: isNil(state.seed) ? randomSeed() : null })),
  ...createLoadActions(set, get),
  reset: () => set({ ...defaults() }),
  registerMentionInserter: (fn) => {
    mentionInserter = fn
  },
  registerSlotFocuser: (fn) => {
    slotFocuser = fn
  },
  upsertUploads: (uploads) => {
    set((state) => ({ uploadsById: { ...state.uploadsById, ...keyBy(uploads, 'id') } }))
    get().normalizeLoaded()
  },
})
