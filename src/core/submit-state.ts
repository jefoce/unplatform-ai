import { isNil } from 'lodash-es'

import type { UploadsById } from './api/uploads'
import { GRACE_STALE_MS } from './constants'
import { isNonEmptyString, isOneOf } from './guards'
import { primaryBinding } from './presets/common/bindings'
import type { VideoPreset } from './presets/video/types'
import {
  type GenerationInput,
  type GenerationRecord,
  type InputSnapshot,
  JOB_STATUSES,
  type JobStatus,
  type RecordSubmit,
} from './schemas/generation-record'
import { type ResolvedTransport, resolveTransport } from './transport'
import type { Dict } from './utility-types'

function parseNotBefore(notBefore: string | undefined): number {
  if (!isNonEmptyString(notBefore)) {
    return Number.NaN
  }

  return Date.parse(notBefore)
}

/** Remaining grace delay in ms. A missing, invalid or past notBefore is 0. */
export function graceDelayMs(notBefore: string | undefined, now = Date.now()): number {
  const at = parseNotBefore(notBefore)

  if (!Number.isFinite(at)) {
    return 0
  }

  return Math.max(0, at - now)
}

/** True when a grace record waited longer than GRACE_STALE_MS past notBefore. */
interface StaleGraceRecord {
  status: string
  submit?: RecordSubmit
}

export function isStaleGrace(record: StaleGraceRecord, now = Date.now()): boolean {
  if (record.status !== 'submitting' || record.submit?.stage !== 'grace') {
    return false
  }

  const at = parseNotBefore(record.submit.notBefore)

  return Number.isFinite(at) && now - at > GRACE_STALE_MS
}

/** Cancel is allowed only before anything was uploaded or sent. */
export function canCancelInGrace(
  record: Pick<GenerationRecord, 'status' | 'submit' | 'job'>,
): boolean {
  return (
    record.status === 'submitting' &&
    !isNonEmptyString(record.job?.id) &&
    record.submit?.stage === 'grace'
  )
}

/** Every upload id referenced by a normalized input, in order, deduplicated. */
export function inputIds(input: GenerationInput): string[] {
  const ids = [input.frames.start, input.frames.end, ...input.references]

  return [
    ...new Set(
      ids.filter((id): id is string => {
        return !isNil(id)
      }),
    ),
  ]
}

interface TransportsForParams {
  uploads: UploadsById
  preset: VideoPreset
  remoteConfigured: boolean
}

export function transportsFor(params: TransportsForParams): Dict<ResolvedTransport> {
  const { uploads, preset, remoteConfigured: isRemoteConfigured } = params

  return Object.fromEntries(
    Object.values(uploads).map((upload) => {
      return [
        upload.id,
        resolveTransport({
          binding: primaryBinding(preset),
          kind: upload.kind,
          remoteConfigured: isRemoteConfigured,
        }),
      ]
    }),
  )
}

export function withTransports(
  snapshot: InputSnapshot,
  transports: Dict<ResolvedTransport>,
): InputSnapshot {
  return Object.fromEntries(
    Object.entries(snapshot).map(([id, item]) => {
      const transport = transports[id]

      if (isNil(transport)) {
        return [id, item] as const
      }

      return [id, { ...item, transport }] as const
    }),
  )
}

export function base64Only(transports: Dict<ResolvedTransport>): Dict<ResolvedTransport> {
  return Object.fromEntries(
    Object.keys(transports).map((id) => {
      return [id, 'base64'] as const
    }),
  )
}

export function asJobStatus(value: string): JobStatus | null {
  if (isOneOf(JOB_STATUSES, value)) {
    return value
  }

  return null
}
