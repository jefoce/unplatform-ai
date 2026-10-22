'use client'

import { useCallback, useRef, useState } from 'react'
import { TriangleAlert } from 'lucide-react'

import type { RefSlot } from '@/core/prompt-tokens'
import type { ValidationIssue } from '@/core/validation'
import { Chip } from '@/ui/Chip'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/Popover'

import { PromptWarningRow } from './PromptWarningRow'

interface PromptWarningsProps {
  warnings: ValidationIssue[]
  onFocus?: (slot: RefSlot, occurrence: number) => void
}

/** Warning counter chip with a clickable list. Hidden when there are none. */
export function PromptWarnings(props: PromptWarningsProps) {
  const { warnings, onFocus } = props
  const [isOpen, setIsOpen] = useState(false)
  const handleOpenChange = setIsOpen
  const occurrences = useRef<Record<string, number>>({})
  const handleGo = useCallback(
    (slot: RefSlot): void => {
      const key = `${slot.kind}-${slot.n}`
      const occurrence = occurrences.current[key] ?? 0

      occurrences.current[key] = occurrence + 1
      onFocus?.(slot, occurrence)
      setIsOpen(false)
    },
    [onFocus],
  )

  if (warnings.length === 0) return null

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
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
        {warnings.map((issue, index) => (
          // eslint-disable-next-line react/no-array-index-key -- static list
          <PromptWarningRow key={`${issue.type}-${index}`} issue={issue} onSelect={handleGo} />
        ))}
      </PopoverContent>
    </Popover>
  )
}
