'use client'

import type { StoreApi } from 'zustand'

import { getPreset } from '@/core/presets'

import type { GeneratorState } from './store-actions'

type SetState = StoreApi<GeneratorState>['setState']

type FrameActions = Pick<GeneratorState, 'setFrame'>

/** Frame slot attach and clear actions, kept out of the store creator. */
export function createFrameActions(set: SetState): FrameActions {
  return {
    setFrame: (slot, upload) =>
      set((state) => {
        const preset = getPreset(state.presetId)
        const frames = { ...state.frames, [slot]: upload?.id ?? null }
        const shouldClearStart = slot === 'start' && !upload

        if (shouldClearStart) frames.end = null

        let uploadsById = state.uploadsById

        if (upload) uploadsById = { ...state.uploadsById, [upload.id]: upload }

        const aspectRatio =
          shouldClearStart && state.aspectRatio === 'auto'
            ? preset.defaultAspectRatio
            : state.aspectRatio

        return { frames, uploadsById, aspectRatio }
      }),
  }
}
