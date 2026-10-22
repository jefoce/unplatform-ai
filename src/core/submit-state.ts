import { isNil } from 'lodash-es'

import { GRACE_STALE_MS } from './constants'
import {
  buildOpenRouterBody,
  type BuildOpenRouterBodyParams,
  type OpenRouterVideoBody,
} from './openrouter-body'
import type { ModelPreset } from './presets'
import { type ResolvedTransport, resolveTransport } from './transport'
import type { GenerationInput, GenerationRecord, JobStatus, UploadItem } from './types'

/** Remaining grace delay in ms. A missing, invalid or past notBefore is 0. */
export function graceDelayMs(notBefore: string | undefined, now = Date.now()): number {
  const at = isNil(notBefore) || notBefore === '' ? Number.NaN : Date.parse(notBefore)

  if (!Number.isFinite(at)) return 0

  return Math.max(0, at - now)
}

/** True when a grace record waited longer than GRACE_STALE_MS past notBefore. */
export function isStaleGrace(
  record: Pick<GenerationRecord, 'status' | 'submit'>,
  now = Date.now(),
): boolean {
  if (record.status !== 'submitting' || record.submit?.stage !== 'grace') return false

  const notBefore = record.submit.notBefore
  const at = isNil(notBefore) || notBefore === '' ? Number.NaN : Date.parse(notBefore)

  return Number.isFinite(at) && now - at > GRACE_STALE_MS
}

/** Cancel is allowed only before anything was uploaded or sent. */
export function canCancelInGrace(
  record: Pick<GenerationRecord, 'status' | 'submit' | 'job'>,
): boolean {
  return (
    record.status === 'submitting' &&
    (isNil(record.job?.id) || record.job?.id === '') &&
    record.submit?.stage === 'grace'
  )
}

/** Every upload id referenced by a normalized input, in order, deduplicated. */
export function inputIds(input: GenerationInput): string[] {
  const ids = [input.frames.start, input.frames.end, ...input.references]

  return [...new Set(ids.filter((id): id is string => !isNil(id)))]
}

interface TransportsForParams {
  uploads: Record<string, UploadItem>
  preset: ModelPreset
  remoteConfigured: boolean
}

export function transportsFor(params: TransportsForParams): Record<string, ResolvedTransport> {
  const { uploads, preset, remoteConfigured: isRemoteConfigured } = params

  return Object.fromEntries(
    Object.values(uploads).map((upload) => [
      upload.id,
      resolveTransport({ preset, kind: upload.kind, remoteConfigured: isRemoteConfigured }),
    ]),
  )
}

export function withTransports(
  snapshot: GenerationRecord['inputsSnapshot'],
  transports: Record<string, ResolvedTransport>,
): GenerationRecord['inputsSnapshot'] {
  return Object.fromEntries(
    Object.entries(snapshot).map(([id, item]) => {
      const transport = transports[id]

      if (isNil(transport)) return [id, item] as const

      return [id, { ...item, transport }] as const
    }),
  )
}

export function base64Only(
  transports: Record<string, ResolvedTransport>,
): Record<string, ResolvedTransport> {
  return Object.fromEntries(Object.keys(transports).map((id) => [id, 'base64'] as const))
}

export function bodyFor(params: BuildOpenRouterBodyParams): OpenRouterVideoBody {
  return buildOpenRouterBody(params)
}

const JOB_STATUSES: JobStatus[] = [
  'submitting',
  'pending',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
  'expired',
]

export function asJobStatus(value: string): JobStatus | null {
  return JOB_STATUSES.includes(value as JobStatus) ? (value as JobStatus) : null
}
