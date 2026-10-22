import 'server-only'

import { isNil } from 'lodash-es'

import { MAX_JOB_AGE_MIN } from '@/core/constants'
import { asJobStatus } from '@/core/submit-state'
import type { GenerationRecord, JobStatus } from '@/core/types'

import {
  getVideoJob,
  isMockMode,
  OpenRouterError,
  type VideoJobResponse,
} from '../openrouter/client'
import { saveGeneration } from '../repos/generations'
import { queueDownload } from './download-queue'

const FINAL: JobStatus[] = ['completed', 'failed', 'cancelled', 'expired']

/** Fetches the latest job, updates the record and hands completed work to the download queue. */
export async function processRecord(record: GenerationRecord): Promise<void> {
  const current = record.job

  if (isNil(current) || current.id === '') return

  const job = await pollJob({ record, current })

  if (!job) return

  const status = asJobStatus(job.status) ?? record.status

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
  current: NonNullable<GenerationRecord['job']>
}

/** Returns null when the tick handled the provider error. */
async function pollJob(params: PollJobParams): Promise<VideoJobResponse | null> {
  const { record, current } = params

  try {
    return await getVideoJob(current.id, { submittedAt: current.submittedAt })
  } catch (error) {
    if (await handleJobError(record, error)) return null

    throw error
  }
}

interface PrepareNextParams {
  record: GenerationRecord
  current: NonNullable<GenerationRecord['job']>
  job: VideoJobResponse
  status: JobStatus
  now: string
}

interface PreparedRecord {
  next: GenerationRecord
  jobFields: NonNullable<GenerationRecord['job']>
}

function prepareNext(params: PrepareNextParams): PreparedRecord {
  const { record, current, job, status, now } = params
  const jobFields = {
    ...current,
    generationId: job.generation_id ?? current.generationId,
    expiresAt: job.expires_at ?? current.expiresAt,
  }

  if (status === 'in_progress' && (isNil(current.startedAt) || current.startedAt === '')) {
    jobFields.startedAt = now
  }

  const next = applyUsageCost({
    record: {
      ...record,
      status,
      job: jobFields,
      error: status === 'failed' ? record.error : undefined,
    },
    job,
  })

  return { next, jobFields }
}

interface ApplyUsageCostParams {
  record: GenerationRecord
  job: VideoJobResponse
}

function applyUsageCost(params: ApplyUsageCostParams): GenerationRecord {
  const { record, job } = params
  const usageCost = job.usage?.cost

  if (isNil(usageCost)) return record

  const actual = isMockMode() ? record.cost.estimatedUsd : usageCost

  return {
    ...record,
    cost: {
      ...record.cost,
      actualUsd: actual,
      isByok: job.usage?.is_byok ?? null,
      billed: actual > 0,
    },
  }
}

interface FinishFinalParams {
  record: GenerationRecord
  status: JobStatus
  jobFields: NonNullable<GenerationRecord['job']>
  job: VideoJobResponse
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

function finalizeCost(record: GenerationRecord, job: VideoJobResponse): GenerationRecord {
  if (!isNil(job.usage?.cost)) return record

  return { ...record, cost: { ...record.cost, actualUsd: 0, billed: false } }
}

/** Returns true when the error was handled and this tick should stop. */
async function handleJobError(record: GenerationRecord, error: unknown): Promise<boolean> {
  if (!(error instanceof OpenRouterError)) return false

  if (error.status === 404) {
    await saveGeneration({ ...record, status: 'failed', error: 'Job not found on OpenRouter' })

    return true
  }

  if (error.status === 401 || error.status === 403) {
    const text = `OpenRouter auth failed: ${error.message}`

    if (record.error !== text) await saveGeneration({ ...record, error: text })

    return true
  }

  return error.status === 0 || error.status === 429 || error.status >= 500
}

function isAgedOut(record: GenerationRecord, status: JobStatus): boolean {
  if (status !== 'pending' && status !== 'in_progress') return false

  return Date.now() - Date.parse(record.createdAt) > MAX_JOB_AGE_MIN * 60_000
}
