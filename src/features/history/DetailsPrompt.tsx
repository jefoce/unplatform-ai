'use client'

import { useCallback } from 'react'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'

import type { GenerationRecord } from '@/core/types'

import { PromptText } from './PromptText'

interface DetailsPromptProps {
  record: GenerationRecord
  plain: string
}

async function copyText(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copied`)
  } catch {
    toast.error('Copy failed')
  }
}

/** Prompt block with its copy button. */
export function DetailsPrompt(props: DetailsPromptProps) {
  const { record, plain } = props
  const handleCopyPrompt = useCallback(() => void copyText(plain, 'Prompt'), [plain])

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
      {plain === '' ? (
        <p className="pt-1 text-sm text-fg-2">No prompt</p>
      ) : (
        <div className="max-h-40 min-h-0 overflow-y-auto">
          <p className="pt-1 text-sm whitespace-pre-wrap text-fg-2">
            <PromptText prompt={plain} record={record} />
          </p>
        </div>
      )}
    </div>
  )
}
