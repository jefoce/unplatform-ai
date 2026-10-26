'use client'

import { clamp, isNil, keyBy } from 'lodash-es'
import type { StateCreator } from 'zustand'

import { SEED_MAX } from '@/core/constants'
import type { RefSlot } from '@/core/prompt-tokens'

import { defaults } from './store-draft'
import { createDraftActions } from './store-draft-actions'
import { createFrameActions } from './store-frame-actions'
import { randomSeed } from './store-helpers'
import { createLoadActions } from './store-load-actions'
import { createReferenceActions } from './store-reference-actions'
import type { GeneratorState } from './store-state'

type MentionInserter = (slot: RefSlot) => void

type SlotFocuser = (slot: RefSlot, occurrence: number) => void

let mentionInserter: MentionInserter | null = null
let slotFocuser: SlotFocuser | null = null

function clampSeed(seed: number | null): number | null {
  if (isNil(seed)) {
    return null
  }

  return clamp(Math.round(seed), 0, SEED_MAX)
}

/** Draft state and its actions, wired to persist by store.ts. */
export const createGeneratorState: StateCreator<
  GeneratorState,
  [['zustand/persist', unknown]],
  []
> = (set, get) => {
  return {
    ...defaults(),
    uploadsById: {},
    activeCount: 0,
    setActiveCount: (activeCount) => {
      set({ activeCount })
    },
    ...createDraftActions(set),
    ...createFrameActions(set),
    ...createReferenceActions(set),
    insertMention: (slot) => {
      return mentionInserter?.(slot)
    },
    focusSlot: (slot, occurrence) => {
      return slotFocuser?.(slot, occurrence)
    },
    setSeed: (seed) => {
      set({ seed: clampSeed(seed) })
    },
    toggleSeedLock: () => {
      set((state) => {
        if (isNil(state.seed)) {
          return { seed: randomSeed() }
        }

        return { seed: null }
      })
    },
    ...createLoadActions(set, get),
    reset: () => {
      set({ ...defaults() })
    },
    registerMentionInserter: (fn) => {
      mentionInserter = fn
    },
    registerSlotFocuser: (fn) => {
      slotFocuser = fn
    },
    upsertUploads: (uploads) => {
      set((state) => {
        return { uploadsById: { ...state.uploadsById, ...keyBy(uploads, 'id') } }
      })

      get().normalizeLoaded()
    },
  }
}
