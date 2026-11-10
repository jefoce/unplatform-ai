import 'server-only'

import { isNil } from 'lodash-es'

import { MAX_JOB_AGE_MIN } from '@/core/constants'
import { isNonEmptyString } from '@/core/guards'
import type {
  GenerationRecord,
  JobStatus,
  RecordJob,
  RecordProgress,
} from '@/core/schemas/generation-record'
import { ACTIVE_STATUSES, TERMINAL_STATUSES } from '@/core/types'

import { getEndpointSync } from '../providers/custom/endpoint-source'
import { instanceIdOf } from '../providers/custom/record-instance'
import { ProviderError, type ProviderErrorKind } from '../providers/provider-error'
import { getVideoProvider } from '../providers/registry'
import type { JobProgress, JobSnapshot } from '../providers/types'
import { updateGeneration } from '../repos/generations'
import { recordHealthFromError, recordHealthOk } from '../services/endpoint-health'
import { errorTextOf } from './custom-endpoint-errors'
import { queueDownload } from './download-queue'
import { writeTransientOffline } from './transient-offline'

const RETRY_KINDS: readonly ProviderErrorKind[] = ['timeout', 'rate_limit', 'server']

const ENDPOINT_REMOVED_TEXT = 'upai:endpoint_removed: Endpoint removed'

/** Fetches the latest job, then merges it under the record lock. */
export async function processRecord(record: GenerationRecord): Promise<void> {
  const current = record.job

  if (isNil(current) || !isNonEmptyString(current.id)) {
    return
  }

  let job = await pollJob({ record, current })

  if (!job) {
    return
  }

  if (isAgedOut(record, job.status)) {
    job = await pollJob({ record, current })

    if (!job) {
      return
    }

    if (isAgedOut(record, job.status)) {
      await updateGeneration(record.id, (latest) => {
        if (!ACTIVE_STATUSES.includes(latest.status)) {
          return null
        }

        return { ...latest, status: 'expired', error: 'Job expired' }
      })

      return
    }
  }

  const status = job.status
  const now = new Date().toISOString()

  if (!TERMINAL_STATUSES.includes(status)) {
    await updateGeneration(record.id, (latest) => {
      return mergeJob({ record: latest, job, status, now })
    })

    return
  }

  await finishFinal({ id: record.id, status, job, now })
}

interface PollJobParams {
  record: GenerationRecord
  current: RecordJob
}

/** Returns null when the tick handled the provider error. */
async function pollJob(params: PollJobParams): Promise<JobSnapshot | null> {
  const { record, current } = params
  const instanceId = instanceIdOf(record)

  if (record.provider === 'custom' && isNil(getEndpointSync(instanceId))) {
    await failEndpointRemoved(record.id)

    return null
  }

  try {
    const snapshot = await getVideoProvider(instanceId).getJob({
      jobId: current.id,
      submittedAt: current.submittedAt,
    })

    if (record.provider === 'custom') {
      recordHealthOk(instanceId)
    }

    return snapshot
  } catch (error) {
    if (record.provider === 'custom') {
      const isOffline = recordHealthFromError({
        endpointId: instanceId,
        error,
        source: 'job',
        isJobRunning: true,
      })

      if (isOffline) {
        await writeTransientOffline(record.id, error)
      }
    }

    if (await handleJobError(record, error)) {
      return null
    }

    throw error
  }
}

async function failEndpointRemoved(id: string): Promise<void> {
  await updateGeneration(id, (latest) => {
    if (!ACTIVE_STATUSES.includes(latest.status)) {
      return null
    }

    return { ...latest, status: 'failed', error: ENDPOINT_REMOVED_TEXT, errorStatus: undefined }
  })
}

interface MergeJobParams {
  record: GenerationRecord
  job: JobSnapshot
  status: JobStatus
  now: string
}

/** Applies one poll result to the freshest record. Null when it is no longer active. */
function mergeJob(params: MergeJobParams): GenerationRecord | null {
  const { record, job, status, now } = params
  const current = record.job

  if (!ACTIVE_STATUSES.includes(record.status) || isNil(current)) {
    return null
  }

  const jobFields = {
    ...current,
    generationId: job.generationId ?? current.generationId,
    expiresAt: job.expiresAt ?? current.expiresAt,
  }

  if (status === 'in_progress' && !isNonEmptyString(current.startedAt)) {
    jobFields.startedAt = now
  }

  const error = status === 'failed' ? record.error : undefined
  const errorStatus = status === 'failed' ? record.errorStatus : undefined

  return applyUsageCost({
    record: {
      ...record,
      status,
      job: jobFields,
      progress: recordProgress(job.progress) ?? record.progress,
      error,
      errorStatus,
    },
    job,
  })
}

/** Provider progress without the workflow node, which the record no longer keeps. */
function recordProgress(progress: JobProgress | undefined): RecordProgress | undefined {
  if (isNil(progress)) {
    return undefined
  }

  return {
    percent: progress.percent,
    queuePosition: progress.queuePosition,
    waitingOn: progress.waitingOn,
  }
}

interface ApplyUsageCostParams {
  record: GenerationRecord
  job: JobSnapshot
}

function applyUsageCost(params: ApplyUsageCostParams): GenerationRecord {
  const { record, job } = params
  const usage = job.usage

  if (isNil(usage) || isNil(usage.costUsd)) {
    return record
  }

  const actual = usage.usesEstimatedCost ? record.cost.estimatedUsd : usage.costUsd

  return {
    ...record,
    cost: {
      ...record.cost,
      actualUsd: actual,
      isByok: usage.isByok ?? null,
      billed: actual > 0,
    },
  }
}

interface FinishFinalParams {
  id: string
  status: JobStatus
  job: JobSnapshot
  now: string
}

async function finishFinal(params: FinishFinalParams): Promise<void> {
  const { id, status, job, now } = params

  const saved = await updateGeneration(id, (latest) => {
    const merged = mergeJob({ record: latest, job, status, now })

    if (isNil(merged) || isNil(merged.job)) {
      return null
    }

    const next = {
      ...merged,
      job: { ...merged.job, completedAt: merged.job.completedAt ?? now },
    }

    if (status === 'completed') {
      let costed = next

      if (isUnreportedCustomCost({ record: next, job })) {
        const actual = next.cost.estimatedUsd

        costed = {
          ...next,
          cost: { ...next.cost, actualUsd: actual, billed: actual > 0 },
        }
      }

      // The download queue owns the record until the poster and output exist.
      return { ...costed, status: 'in_progress', download: { startedAt: now } }
    }

    const fallback = status === 'expired' ? 'Job expired' : `Job ${status}`

    return { ...finalizeCost(next, job), error: job.error ?? fallback }
  })

  if (!isNil(saved) && status === 'completed') {
    await queueDownload(saved, job)
  }
}

interface UnreportedCostParams {
  record: GenerationRecord
  job: JobSnapshot
}

/** A custom run that reports zero is treated as unreported. */
function isUnreportedCustomCost(params: UnreportedCostParams): boolean {
  const { record, job } = params
  const costUsd = job.usage?.costUsd

  return record.provider === 'custom' && (isNil(costUsd) || costUsd === 0)
}

function finalizeCost(record: GenerationRecord, job: JobSnapshot): GenerationRecord {
  if (!isNil(job.usage?.costUsd)) {
    return record
  }

  // A local run is never billed by the pack, so the resolved price is the actual cost.
  const actual = record.provider === 'custom' ? record.cost.estimatedUsd : 0

  return { ...record, cost: { ...record.cost, actualUsd: actual, billed: actual > 0 } }
}

/** Returns true when the error was handled and this tick should stop. */
async function handleJobError(record: GenerationRecord, error: unknown): Promise<boolean> {
  if (!(error instanceof ProviderError)) {
    return false
  }

  if (error.kind === 'not_found') {
    await updateGeneration(record.id, (latest) => {
      if (!ACTIVE_STATUSES.includes(latest.status)) {
        return null
      }

      return { ...latest, status: 'failed', error: error.storedMessage, errorStatus: error.status }
    })

    return true
  }

  if (error.kind === 'auth' || error.kind === 'no_key') {
    const text = errorTextOf(error)

    await updateGeneration(record.id, (latest) => {
      if (latest.error === text) {
        return null
      }

      return { ...latest, error: text, errorStatus: error.status }
    })

    return true
  }

  return RETRY_KINDS.includes(error.kind)
}

function isAgedOut(record: GenerationRecord, status: JobStatus): boolean {
  if (status !== 'pending' && status !== 'in_progress') {
    return false
  }

  return Date.now() - Date.parse(record.createdAt) > MAX_JOB_AGE_MIN * 60_000
}
