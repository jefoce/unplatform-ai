'use client'

import { useMemo } from 'react'

import { useGeneratorStore } from '../store/store'

/** Mention source and video-only editor wiring for the prompt field. */
export function usePanelMentions() {
  const tab = useGeneratorStore((state) => {
    return state.tab
  })

  const references = useGeneratorStore((state) => {
    return state.references
  })

  const uploadsById = useGeneratorStore((state) => {
    return state.uploadsById
  })

  const focusSlot = useGeneratorStore((state) => {
    return state.focusSlot
  })

  const registerMentionInserter = useGeneratorStore((state) => {
    return state.registerMentionInserter
  })

  const registerSlotFocuser = useGeneratorStore((state) => {
    return state.registerSlotFocuser
  })

  const mentions = useMemo(() => {
    return { references, uploadsById }
  }, [references, uploadsById])

  return {
    mentions,
    isReferences: tab === 'references',
    onFocusSlot: focusSlot,
    onRegisterInserter: registerMentionInserter,
    onRegisterFocuser: registerSlotFocuser,
  }
}
