'use client'

import { uniq } from 'lodash-es'
import type { StoreApi } from 'zustand'

import { getPreset } from '@/core/presets'

import type { GeneratorState } from './store-actions'
import { inputFromState } from './store-draft'
import { clampReferenceDuration, kindCounts } from './store-helpers'

type SetState = StoreApi<GeneratorState>['setState']

type ReferenceActions = Pick<
  GeneratorState,
  'addReferences' | 'replaceReference' | 'removeReference'
>

/** Reference add, replace and remove actions, kept out of the store creator. */
export function createReferenceActions(set: SetState): ReferenceActions {
  return {
    addReferences: (items) =>
      set((state) => {
        const preset = getPreset(state.presetId)
        const uploadsById = { ...state.uploadsById }
        const references = [...state.references]
        const counts = kindCounts(references, uploadsById)

        for (const item of items) {
          uploadsById[item.id] = item

          if (references.includes(item.id)) continue

          if (counts[item.kind] >= preset.references[item.kind]) continue

          references.push(item.id)
          counts[item.kind] += 1
        }

        const duration = clampReferenceDuration({
          input: inputFromState({ ...state, references }),
          uploads: uploadsById,
          preset,
        })

        return { references, uploadsById, duration }
      }),
    replaceReference: (id, upload) =>
      set((state) => {
        const uploadsById = { ...state.uploadsById, [upload.id]: upload }
        const index = state.references.indexOf(id)
        const swapped = state.references.map((ref) => (ref === id ? upload.id : ref))
        let candidates = swapped

        if (index < 0) candidates = [...swapped, upload.id]

        const references = uniq(candidates)
        const preset = getPreset(state.presetId)
        const duration = clampReferenceDuration({
          input: inputFromState({ ...state, references }),
          uploads: uploadsById,
          preset,
        })

        return { references, uploadsById, duration }
      }),
    removeReference: (id) =>
      set((state) => {
        const references = state.references.filter((ref) => ref !== id)
        const preset = getPreset(state.presetId)
        const duration = clampReferenceDuration({
          input: inputFromState({ ...state, references }),
          uploads: state.uploadsById,
          preset,
        })

        return { references, duration }
      }),
  }
}
