'use client'

import type { StatusHelp } from '@/core/status-help'
import type { GenerationRecord } from '@/core/types'
import { cn } from '@/lib/cn'

import { GraceCancel } from './GraceCancel'
import { type Tone } from './status-tone'
import { StatusPill } from './StatusPill'

const noop = (): void => {}

interface ActiveStatusProps {
  record: GenerationRecord
  isCompact: boolean
  canCancel: boolean
  graceSeconds: number
  tone: Tone
  label: string
  help: StatusHelp
  onCancel?: () => void
}

/** Active card: pill and optional grace cancel. */
export function ActiveStatus(props: ActiveStatusProps) {
  const {
    record,
    isCompact,
    canCancel,
    graceSeconds,
    tone,
    label,
    help,
    onCancel: handleCancel,
  } = props
  const handleCancelClick = handleCancel ?? noop

  return (
    <div
      className={cn(
        'absolute inset-x-4 top-4 z-10 flex flex-col gap-3',
        isCompact && 'inset-x-3 top-3',
      )}
    >
      <div className={cn('flex flex-wrap items-start gap-2', isCompact && 'gap-1.5')}>
        <StatusPill label={label} help={help} tone={tone} isCompact={isCompact} />

        {canCancel && (
          <GraceCancel
            key={record.submit?.notBefore}
            notBefore={record.submit?.notBefore}
            seconds={graceSeconds}
            compact={isCompact}
            onCancel={handleCancelClick}
          />
        )}
      </div>
    </div>
  )
}
