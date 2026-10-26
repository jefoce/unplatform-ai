import { isNil } from 'lodash-es'

import type { FriendlyError } from '@/core/provider-errors/types'
import type { GenerationRecord, JobStatus } from '@/core/schemas/generation-record'
import { STATUS_HELP, statusHelpKey } from '@/core/status-help'

export type Tone = 'lime' | 'gray' | 'red'

const TONES: Record<JobStatus, Tone> = {
  submitting: 'gray',
  pending: 'gray',
  in_progress: 'lime',
  completed: 'gray',
  failed: 'red',
  cancelled: 'red',
  expired: 'red',
}

export const TONE_TEXT: Record<Tone, string> = {
  lime: 'text-lime',
  gray: 'text-fg-2',
  red: 'text-danger',
}

export const GLOW_CLASSES = {
  lime: 'glow glow-lime',
  gray: 'glow glow-gray',
  red: 'glow glow-red',
} satisfies Record<Tone, string>

export const PILL_CLASSES =
  'inline-flex h-9 max-w-full shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-line px-3 text-sm font-semibold shadow-[inset_0_0_0_1px_var(--color-line)] backdrop-blur-sm'

export const PILL_COMPACT_CLASSES = 'h-7 gap-1.5 px-2 text-xs'

const CANCELLED_TEXT = 'Not sent, not charged.'

export function statusLabel(record: GenerationRecord): string {
  const base = STATUS_HELP[statusHelpKey(record)].label
  const progress = record.submit?.stage === 'uploading' ? record.submit.progress : undefined

  if (isNil(progress)) {
    return base
  }

  return `${base} ${progress}%`
}

/** Gray while a submit stage or download is running, otherwise the status tone. */
export function statusTone(record: GenerationRecord): Tone {
  if (!isNil(record.submit?.stage)) {
    return 'gray'
  }

  if (record.download) {
    return 'gray'
  }

  return TONES[record.status]
}

/** Friendly hint, else the cancelled note. */
export function statusLine(
  record: GenerationRecord,
  friendly: FriendlyError | null,
): string | null {
  if (!isNil(friendly) && !isNil(friendly.hint)) {
    return friendly.hint
  }

  if (record.status === 'cancelled') {
    return CANCELLED_TEXT
  }

  return null
}

/** True while a submit is inside its cancel grace window. */
export function isGraceRecord(record: GenerationRecord): boolean {
  return record.status === 'submitting' && record.submit?.stage === 'grace'
}

interface GraceCancelVisibleParams {
  record: GenerationRecord
  remainingMs: number
  onCancel?: () => void
}

/** Grace records keep the cancel pill only while time remains. */
export function isGraceCancelVisible(params: GraceCancelVisibleParams): boolean {
  const { record, remainingMs, onCancel } = params

  if (!isGraceRecord(record)) {
    return false
  }

  return remainingMs > 0 && !isNil(onCancel)
}
