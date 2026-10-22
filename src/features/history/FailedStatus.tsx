'use client'

import { isNil } from 'lodash-es'

import type { FriendlyError } from '@/core/provider-errors'
import type { StatusHelp } from '@/core/status-help'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/Button'

import { ErrorDetailsPopover } from './ErrorDetailsPopover'
import { SelectionCheckbox } from './SelectionCheckbox'
import type { Tone } from './status-tone'
import { StatusPill } from './StatusPill'

interface FailedStatusProps {
  id: string
  isCompact: boolean
  isSelecting: boolean
  label: string
  help: StatusHelp
  tone: Tone
  friendly: FriendlyError | null
  line: string | null
  onRerun: () => void
}

/** Failed card: pill and checkbox in the corner, reason and actions in the middle. */
export function FailedStatus(props: FailedStatusProps) {
  const {
    id,
    isCompact,
    isSelecting,
    label,
    help,
    tone,
    friendly,
    line,
    onRerun: handleRerun,
  } = props

  return (
    <>
      <div className={cn('absolute z-30', isCompact ? 'top-3 left-3' : 'top-4 left-4')}>
        <div
          className={cn(
            'transition-opacity duration-150',
            isSelecting
              ? 'pointer-events-none opacity-0'
              : 'group-hover/card:pointer-events-none group-hover/card:opacity-0 group-has-[:focus-visible]/card:pointer-events-none group-has-[:focus-visible]/card:opacity-0',
          )}
        >
          <StatusPill label={label} help={help} tone={tone} isCompact={isCompact} />
        </div>
      </div>
      <SelectionCheckbox id={id} />

      {!isCompact && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 pt-14 text-center">
          <p className="line-clamp-2 text-danger">{friendly?.title ?? help.label}</p>
          {!isNil(line) && <p className="line-clamp-3 text-sm text-fg-2">{line}</p>}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" variant="outline" onClick={handleRerun}>
              Reuse
            </Button>
            {!isNil(friendly) && <ErrorDetailsPopover error={friendly} />}
          </div>
        </div>
      )}
    </>
  )
}
