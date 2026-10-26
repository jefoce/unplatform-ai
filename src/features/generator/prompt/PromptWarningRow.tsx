'use client'

import { type RefSlot, slotLabel } from '@/core/prompt-tokens'
import { issueText } from '@/core/validation'
import type { ValidationIssue } from '@/core/validation-types'

interface PromptWarningRowProps {
  issue: ValidationIssue
  onSelect: (slot: RefSlot) => void
}

/** One warning row: plain text or a button that focuses its slot. */
export function PromptWarningRow(props: PromptWarningRowProps) {
  const { issue } = props

  const handleSelect = (): void => {
    if (issue.type !== 'text') {
      props.onSelect(issue.slot)
    }
  }

  if (issue.type === 'text') {
    return <p className="px-2 py-1.5 text-xs text-fg">{issue.text}</p>
  }

  const chip = `@${slotLabel(issue.slot)}`

  return (
    <button
      type="button"
      onClick={handleSelect}
      className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-fg hover:bg-white/5"
    >
      <span className="inline-flex shrink-0 items-center rounded-sm bg-danger/10 px-1 font-medium text-danger">
        {chip}
      </span>
      <span className="text-fg-2">{issueText(issue).replace(`${chip} `, '')}</span>
    </button>
  )
}
