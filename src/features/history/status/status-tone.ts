import { isNil } from 'lodash-es'

import { isDownloadFailure } from '@/core/download-failure'
import { isNonEmptyString } from '@/core/guards'
import type { FriendlyError } from '@/core/provider-errors/types'
import type { GenerationRecord, JobStatus } from '@/core/schemas/generation-record'
import { STATUS_HELP, statusHelpKey } from '@/core/status-help'

export type Tone = 'accent' | 'gray' | 'red'

const TONES: Record<JobStatus, Tone> = {
  submitting: 'gray',
  pending: 'gray',
  in_progress: 'accent',
  completed: 'gray',
  failed: 'red',
  cancelled: 'red',
  expired: 'red',
}

export const TONE_TEXT: Record<Tone, string> = {
  accent: 'text-accent',
  gray: 'text-fg-2',
  red: 'text-danger',
}

export const GLOW_CLASSES = {
  accent: 'glow glow-accent',
  gray: 'glow glow-gray',
  red: 'glow glow-red',
} satisfies Record<Tone, string>

export const PILL_CLASSES =
  'inline-flex h-8 max-w-full items-center gap-0 whitespace-nowrap rounded-full bg-line px-2 text-xs font-semibold shadow-[inset_0_0_0_1px_var(--color-line)] backdrop-blur-sm linux:bg-solid-pill @min-[240px]:h-9 @min-[240px]:gap-2 @min-[240px]:px-3 @min-[240px]:text-sm'

/** Visually hidden but measurable, and read by screen readers. */
export const PILL_LABEL_CLASSES = 'sr-only @max-[239px]:sr-only'

export const PILL_LABEL_SHOWN_CLASSES = 'not-sr-only min-w-0 truncate'

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

/** Failed copy or dropped job, still with a provider job and an unexpired link. */
export function isDownloadRetryable(record: GenerationRecord): boolean {
  const expiresAt = record.job?.expiresAt
  const isRetryable = record.status === 'failed' || record.status === 'expired'

  if (!isRetryable || !isNil(record.output)) {
    return false
  }

  if (record.status === 'failed' && !isDownloadFailure(record)) {
    return false
  }

  if (!isNonEmptyString(record.job?.id)) {
    return false
  }

  return isNil(expiresAt) || Date.now() <= expiresAt
}
