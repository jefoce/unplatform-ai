'use client'

import { useRef } from 'react'
import { TriangleAlert } from 'lucide-react'

import type { RefSlot } from '@/core/prompt-tokens'
import type { Dict } from '@/core/utility-types'
import type { ValidationIssue } from '@/core/validation-types'
import { useBoolean } from '@/lib/use-boolean'
import { Chip } from '@/ui/Chip'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/Popover'

import { PromptWarningRow } from './PromptWarningRow'

interface PromptWarningsProps {
  warnings: ValidationIssue[]
  onFocus?: (slot: RefSlot, occurrence: number) => void
}

/** Warning counter chip with a clickable list. Hidden when there are none. */
export function PromptWarnings(props: PromptWarningsProps) {
  const { warnings } = props
  const warningsPopover = useBoolean()
  const occurrences = useRef<Dict<number>>({})

  const handleOpenChange = (isOpen: boolean): void => {
    warningsPopover.set(isOpen)
  }

  const handleGo = (slot: RefSlot): void => {
    const key = `${slot.kind}-${slot.n}`
    const occurrence = occurrences.current[key] ?? 0

    occurrences.current[key] = occurrence + 1
    props.onFocus?.(slot, occurrence)
    warningsPopover.off()
  }

  if (warnings.length === 0) {
    return null
  }

  return (
    <Popover open={warningsPopover.value} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Chip
          variant="warning"
          aria-label={`${warnings.length} prompt warnings`}
          className="ml-auto"
        >
          <TriangleAlert size={14} aria-hidden />
          {warnings.length}
        </Chip>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-0.5 p-1">
        {warnings.map((issue, index) => {
          return (
            // eslint-disable-next-line react/no-array-index-key -- static list
            <PromptWarningRow key={`${issue.type}-${index}`} issue={issue} onSelect={handleGo} />
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
