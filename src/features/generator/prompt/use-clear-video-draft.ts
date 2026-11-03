'use client'

import { useCallback } from 'react'
import { isEmpty, isNil } from 'lodash-es'
import { useShallow } from 'zustand/react/shallow'

import { useGeneratorStore } from '../store/store'
import type { ClearDraftUndo } from './ClearDraftButton'

interface ClearVideoDraft {
  clear: () => ClearDraftUndo
  isDisabled: boolean
}

/** Clears the active video prompt and its inputs, keeping every setting. */
export function useClearVideoDraft(): ClearVideoDraft {
  const { tab, prompt, frames, references } = useGeneratorStore(
    useShallow((state) => {
      return {
        tab: state.tab,
        prompt: state.prompts[state.tab],
        frames: state.frames,
        references: state.references,
      }
    }),
  )

  const isFrames = tab === 'frames'
  let isDisabled = prompt === '' && isEmpty(references)

  if (isFrames) {
    isDisabled = prompt === '' && isNil(frames.start) && isNil(frames.end)
  }

  const clear = useCallback((): ClearDraftUndo => {
    const state = useGeneratorStore.getState()
    const isFramesTab = state.tab === 'frames'
    const previousPrompt = state.prompts[state.tab]
    const previousFrames = { ...state.frames }
    const previousReferences = [...state.references]
    const previousUploads = state.uploadsById

    if (isFramesTab) {
      useGeneratorStore.setState({
        prompts: { ...state.prompts, frames: '' },
        frames: { start: null, end: null },
      })
    } else {
      useGeneratorStore.setState({
        prompts: { ...state.prompts, references: '' },
        references: [],
      })
    }

    return () => {
      const current = useGeneratorStore.getState()
      const uploadsById = { ...current.uploadsById, ...previousUploads }

      if (isFramesTab) {
        useGeneratorStore.setState({
          prompts: { ...current.prompts, frames: previousPrompt },
          frames: previousFrames,
          uploadsById,
        })

        return
      }

      useGeneratorStore.setState({
        prompts: { ...current.prompts, references: previousPrompt },
        references: previousReferences,
        uploadsById,
      })
    }
  }, [])

  return { clear, isDisabled }
}
