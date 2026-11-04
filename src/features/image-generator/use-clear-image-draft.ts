'use client'

import { useCallback } from 'react'
import { isEmpty } from 'lodash-es'
import { useShallow } from 'zustand/react/shallow'

import type { ClearDraftUndo } from '@/features/generator/prompt/ClearDraftButton'

import { useImageGeneratorStore } from './store'

interface ClearImageDraft {
  clear: () => ClearDraftUndo
  isDisabled: boolean
}

/** Clears the image prompt and references, keeping every setting. */
export function useClearImageDraft(): ClearImageDraft {
  const { prompt, references } = useImageGeneratorStore(
    useShallow((state) => {
      return { prompt: state.prompt, references: state.references }
    }),
  )

  const isDisabled = prompt === '' && isEmpty(references)

  const clear = useCallback((): ClearDraftUndo => {
    const state = useImageGeneratorStore.getState()
    const previousPrompt = state.prompt
    const previousReferences = [...state.references]
    const previousUploads = state.uploadsById

    useImageGeneratorStore.setState({ prompt: '', references: [] })

    return () => {
      const current = useImageGeneratorStore.getState()

      useImageGeneratorStore.setState({
        prompt: previousPrompt,
        references: previousReferences,
        uploadsById: { ...current.uploadsById, ...previousUploads },
      })
    }
  }, [])

  return { clear, isDisabled }
}
