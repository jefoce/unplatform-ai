'use client'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import { STATUS_HELP, statusHelpKey } from '@/core/status-help'
import { graceDelayMs } from '@/core/submit-state'
import { ACTIVE_STATUSES } from '@/core/types'
import { cn } from '@/lib/cn'
import { useNow } from '@/lib/use-now'

import { rerunRecord, retryDownload } from '../actions/record-actions'
import { recordAspect, recordError } from '../actions/record-view'
import { useSelectionItem } from '../selection/use-selection-item'
import { ActiveStatus } from './ActiveStatus'
import { FailedStatus } from './FailedStatus'
import { GlowLayers } from './GlowLayers'
import {
  isDownloadRetryable,
  isGraceCancelVisible,
  isGraceRecord,
  statusLabel,
  statusLine,
  statusTone,
} from './status-tone'

interface StatusOverlayProps {
  record: GenerationRecord
  compact?: boolean
  boxAspect?: string
  fill?: boolean
  onCancel?: () => void
}

/** Placeholder for non-completed records: status pill, glow, timer and cost. */
export function StatusOverlay(props: StatusOverlayProps) {
  const { record, compact: isCompact = false, boxAspect, fill: isFill = false } = props

  const key = statusHelpKey(record)
  const help = STATUS_HELP[key]
  const isGrace = isGraceRecord(record)
  const isActive = ACTIVE_STATUSES.includes(record.status)
  const { selecting: isSelecting } = useSelectionItem(record.id)
  const now = useNow(isActive)

  const label = statusLabel(record)
  const tone = statusTone(record)
  const friendly = recordError(record)
  const line = statusLine(record, friendly)
  const graceNowMs = graceDelayMs(record.submit?.notBefore, now)
  const remainingMs = isGrace ? graceNowMs : 0
  const graceSeconds = Math.ceil(remainingMs / 1000)
  const canCancel = isGraceCancelVisible({ record, remainingMs, onCancel: props.onCancel })
  const isRetryable = isDownloadRetryable(record)
  const aspectStyle = { aspectRatio: boxAspect ?? recordAspect(record), margin: '0 auto' }
  const boxStyle = isFill ? undefined : aspectStyle

  const handleRerun = () => {
    return void rerunRecord(record)
  }

  const handleRetryDownload = () => {
    return void retryDownload(record.id)
  }

  return (
    <div
      className={cn('relative overflow-hidden rounded-2xl bg-surface', isFill && 'h-full w-full')}
      style={boxStyle}
    >
      <GlowLayers tone={tone} />

      {tone === 'red' && (
        <FailedStatus
          id={record.id}
          isCompact={isCompact}
          isSelecting={isSelecting}
          label={label}
          help={help}
          tone={tone}
          friendly={friendly}
          line={line}
          isRetryable={isRetryable}
          onRetry={handleRetryDownload}
          onRerun={handleRerun}
        />
      )}
      {tone !== 'red' && (
        <ActiveStatus
          record={record}
          isCompact={isCompact}
          canCancel={canCancel}
          graceSeconds={graceSeconds}
          tone={tone}
          label={label}
          help={help}
          onCancel={props.onCancel}
        />
      )}
    </div>
  )
}
