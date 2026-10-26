'use client'

import { Copy } from 'lucide-react'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import { copyText } from '@/lib/notify'

import { PromptText } from './PromptText'

interface DetailsPromptProps {
  record: GenerationRecord
  plain: string
}

/** Prompt block with its copy button. */
export function DetailsPrompt(props: DetailsPromptProps) {
  const { record, plain } = props

  const handleCopyPrompt = () => {
    return void copyText(plain, 'Prompt copied')
  }

  return (
    <div className="flex min-h-0 shrink flex-col">
      <div className="flex h-6 items-center justify-between">
        <span className="text-xs/4.5 text-fg-2">Prompt</span>
        <button
          type="button"
          aria-label="Copy prompt"
          onClick={handleCopyPrompt}
          className="inline-flex size-6 items-center justify-center rounded-md text-fg-2 transition hover:bg-hover hover:text-fg"
        >
          <Copy size={13} aria-hidden />
        </button>
      </div>
      {plain === '' && <p className="pt-1 text-sm text-fg-2">No prompt</p>}
      {plain !== '' && (
        <div className="max-h-40 min-h-0 overflow-y-auto">
          <p className="pt-1 text-sm whitespace-pre-wrap text-fg-2">
            <PromptText prompt={plain} record={record} />
          </p>
        </div>
      )}
    </div>
  )
}
