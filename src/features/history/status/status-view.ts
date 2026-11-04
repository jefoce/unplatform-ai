import type { GridItemStatus } from '@/core/feed/grid-item'
import { isNonEmptyString, isOneOf } from '@/core/guards'
import { videoRecordAspect } from '@/core/media/aspect'
import { findImagePreset } from '@/core/presets/image'
import { friendlyError } from '@/core/provider-errors'
import type { FriendlyError } from '@/core/provider-errors/types'
import { providerDescriptor } from '@/core/providers/registry'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { ImageRecord } from '@/core/schemas/image-record'
import {
  imageStatusHelp,
  STATUS_HELP,
  type StatusHelp,
  type StatusHelpKey,
  statusHelpKey,
} from '@/core/status-help'
import { ACTIVE_STATUSES } from '@/core/types'
import { type ImageGridItem } from '@/lib/feed/output-items'

import { rerunRecord, retryDownload } from '../actions/record-actions'
import { recordError } from '../actions/record-view'
import {
  isDownloadRetryable,
  isGraceRecord,
  statusLabel,
  statusLine,
  statusTone,
  type Tone,
} from './status-tone'

/** Everything the shared status overlay renders for one tile. */
export interface StatusView {
  label: string
  tone: Tone
  help: StatusHelp
  error: FriendlyError | null

  /** Grace window start, present only while cancel is still possible. */
  graceNotBefore?: string
  onCancel?: () => void

  /** Failed card body, empty when the status is not red. */
  line?: string | null

  /** Media aspect when the caller does not pass a box aspect. */
  aspect?: string

  /** Keeps the grace timer and clock live. */
  isLive?: boolean

  onRetry?: () => void
  onRerun?: () => void
}

const IMAGE_HELP_KEYS: Record<GridItemStatus, StatusHelpKey> = {
  pending: 'pending',
  in_progress: 'generating',
  completed: 'completed',
  submitting: 'processing',
  saving: 'generating',
  partial: 'failed',
  failed: 'failed',
  cancelled: 'cancelled',
  expired: 'expired',
}

const IMAGE_RED_STATUSES: readonly GridItemStatus[] = ['partial', 'failed', 'cancelled', 'expired']

function imageTone(status: GridItemStatus): Tone {
  if (isOneOf(IMAGE_RED_STATUSES, status)) {
    return 'red'
  }

  return 'gray'
}

function imageHelpKey(item: ImageGridItem): StatusHelpKey {
  const stage = item.source.submit?.stage

  if (stage === 'uploading' || stage === 'sending') {
    return stage
  }

  return IMAGE_HELP_KEYS[item.status]
}

function imageRawError(item: ImageGridItem): string | null {
  if (item.output?.status === 'failed') {
    return item.output.error
  }

  return item.source.error ?? null
}

/** Video record to a status view, including retry and reuse. */
export function videoStatusView(record: GenerationRecord, onCancel?: () => void): StatusView {
  const help = STATUS_HELP[statusHelpKey(record)]
  const friendly = recordError(record)
  const canRetry = isDownloadRetryable(record)

  let graceNotBefore: string | undefined

  if (isGraceRecord(record)) {
    graceNotBefore = record.submit?.notBefore
  }

  let onRetry: (() => void) | undefined

  if (canRetry) {
    onRetry = () => {
      void retryDownload(record.id)
    }
  }

  return {
    label: statusLabel(record),
    tone: statusTone(record),
    help,
    error: friendly,
    line: statusLine(record, friendly),
    graceNotBefore,
    onCancel,
    aspect: videoRecordAspect(record),
    isLive: ACTIVE_STATUSES.includes(record.status),
    onRetry,
    onRerun: () => {
      void rerunRecord(record)
    },
  }
}

interface ImageFriendlyErrorParams {
  record: ImageRecord
  raw: string
  httpCode?: number
}

function imageFriendlyError(params: ImageFriendlyErrorParams): FriendlyError {
  const { record, raw, httpCode } = params

  return friendlyError({
    raw,
    rules: findImagePreset(record.input.presetId)?.errors ?? [],
    httpCode,
    httpRules: providerDescriptor(record.provider).httpRules,
  })
}

/** Failed outputs carry their own provider status, a record error uses the record's. */
function imageErrorStatus(item: ImageGridItem): number | undefined {
  if (item.output?.status === 'failed') {
    return item.output.errorStatus
  }

  return item.source.errorStatus
}

/** Image item to a status view, with its record or output error translated. */
export function imageStatusView(item: ImageGridItem, onCancel?: () => void): StatusView {
  const record = item.source
  const help = imageStatusHelp(imageHelpKey(item))
  const raw = imageRawError(item)
  const isGrace = item.status === 'submitting' && record.submit?.stage === 'grace'

  let friendly: FriendlyError | null = null

  if (isNonEmptyString(raw)) {
    friendly = imageFriendlyError({ record, raw, httpCode: imageErrorStatus(item) })
  }

  let graceNotBefore: string | undefined

  if (isGrace) {
    graceNotBefore = record.submit?.notBefore
  }

  return {
    label: help.label,
    tone: imageTone(item.status),
    help,
    error: friendly,
    line: friendly?.hint ?? null,
    graceNotBefore,
    onCancel,
    isLive: item.status === 'submitting' || item.status === 'saving',
  }
}
