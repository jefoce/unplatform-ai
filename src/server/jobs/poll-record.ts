import 'server-only'

import { isNil } from 'lodash-es'

import { MAX_JOB_AGE_MIN } from '@/core/constants'
import { isNonEmptyString } from '@/core/guards'
import type { GenerationRecord, JobStatus, RecordJob } from '@/core/schemas/generation-record'

import { ProviderError, type ProviderErrorKind } from '../providers/provider-error'
import { getVideoProvider } from '../providers/registry'
import type { JobSnapshot } from '../providers/types'
import { saveGeneration } from '../repos/generations'
import { queueDownload } from './download-queue'

const FINAL: JobStatus[] = ['completed', 'failed', 'cancelled', 'expired']

const RETRY_KINDS: readonly ProviderErrorKind[] = ['timeout', 'rate_limit', 'server']

/** Fetches the latest job, updates the record and hands completed work to the download queue. */
export async function processRecord(record: GenerationRecord): Promise<void> {
  const current = record.job

  if (isNil(current) || !isNonEmptyString(current.id)) {
    return
  }

  const job = await pollJob({ record, current })

  if (!job) {
    return
  }

  const status = job.status

  if (isAgedOut(record, status)) {
    await saveGeneration({ ...record, status: 'expired', error: 'Job expired' })

    return
  }

  const now = new Date().toISOString()
  const prepared = prepareNext({ record, current, job, status, now })

  if (!FINAL.includes(status)) {
    await saveGeneration(prepared.next)

    return
  }

  await finishFinal({ record: prepared.next, status, jobFields: prepared.jobFields, job, now })
}

interface PollJobParams {
  record: GenerationRecord
  current: RecordJob
}

/** Returns null when the tick handled the provider error. */
async function pollJob(params: PollJobParams): Promise<JobSnapshot | null> {
  const { record, current } = params

  try {
    return await getVideoProvider(record.provider).getJob({
      jobId: current.id,
      submittedAt: current.submittedAt,
    })
  } catch (error) {
    if (await handleJobError(record, error)) {
      return null
    }

    throw error
  }
}

interface PrepareNextParams {
  record: GenerationRecord
  current: RecordJob
  job: JobSnapshot
  status: JobStatus
  now: string
}

interface PreparedRecord {
  next: GenerationRecord
  jobFields: RecordJob
}

function prepareNext(params: PrepareNextParams): PreparedRecord {
  const { record, current, job, status, now } = params

  const jobFields = {
    ...current,
    generationId: job.generationId ?? current.generationId,
    expiresAt: job.expiresAt ?? current.expiresAt,
  }

  if (status === 'in_progress' && !isNonEmptyString(current.startedAt)) {
    jobFields.startedAt = now
  }

  const error = status === 'failed' ? record.error : undefined

  const next = applyUsageCost({
    record: {
      ...record,
      status,
      job: jobFields,
      error,
    },
    job,
  })

  return { next, jobFields }
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
  record: GenerationRecord
  status: JobStatus
  jobFields: RecordJob
  job: JobSnapshot
  now: string
}

async function finishFinal(params: FinishFinalParams): Promise<void> {
  const { record, status, jobFields, job, now } = params

  const next = {
    ...record,
    job: { ...jobFields, completedAt: jobFields.completedAt ?? now },
  }

  if (status === 'completed') {
    await queueDownload(next, job)

    return
  }

  const fallback = status === 'expired' ? 'Job expired' : `Job ${status}`

  await saveGeneration({ ...finalizeCost(next, job), error: job.error ?? fallback })
}

function finalizeCost(record: GenerationRecord, job: JobSnapshot): GenerationRecord {
  if (!isNil(job.usage?.costUsd)) {
    return record
  }

  return { ...record, cost: { ...record.cost, actualUsd: 0, billed: false } }
}

/** Returns true when the error was handled and this tick should stop. */
async function handleJobError(record: GenerationRecord, error: unknown): Promise<boolean> {
  if (!(error instanceof ProviderError)) {
    return false
  }

  if (error.kind === 'not_found') {
    await saveGeneration({ ...record, status: 'failed', error: error.storedMessage })

    return true
  }

  if (error.kind === 'auth' || error.kind === 'no_key') {
    const text = `${error.storedMessage}: ${error.message}`

    if (record.error !== text) {
      await saveGeneration({ ...record, error: text })
    }

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
