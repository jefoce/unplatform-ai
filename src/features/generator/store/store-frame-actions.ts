'use client'

import { getPreset } from '@/core/presets'

import type { GeneratorSetState, GeneratorState } from './store-state'

type FrameActions = Pick<GeneratorState, 'setFrame'>

/** Frame slot attach and clear actions, kept out of the store creator. */
export function createFrameActions(set: GeneratorSetState): FrameActions {
  return {
    setFrame: (slot, upload) => {
      set((state) => {
        const preset = getPreset(state.presetId)
        const frames = { ...state.frames, [slot]: upload?.id ?? null }
        const shouldClearStart = slot === 'start' && !upload

        if (shouldClearStart) {
          frames.end = null
        }

        let uploadsById = state.uploadsById

        if (upload) {
          uploadsById = { ...state.uploadsById, [upload.id]: upload }
        }

        const isAspectRatio = shouldClearStart && state.aspectRatio === 'auto'

        const aspectRatio = isAspectRatio ? preset.defaultAspectRatio : state.aspectRatio

        return { frames, uploadsById, aspectRatio }
      })
    },
  }
}
