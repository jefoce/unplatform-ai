'use client'

import { createContext, type ReactNode, useContext } from 'react'

import type { PromptMentions } from './prompt-convert'

const PromptMentionsContext = createContext<PromptMentions | null>(null)

interface PromptMentionsProviderProps {
  mentions: PromptMentions | null
  children: ReactNode
}

/** Shares the mention source with chip nodes inside one prompt editor. */
export function PromptMentionsProvider(props: PromptMentionsProviderProps) {
  return (
    <PromptMentionsContext.Provider value={props.mentions}>
      {props.children}
    </PromptMentionsContext.Provider>
  )
}

export function usePromptMentions(): PromptMentions | null {
  return useContext(PromptMentionsContext)
}
