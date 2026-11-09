import 'server-only'

import { randomUUID } from 'node:crypto'

import { isNil } from 'lodash-es'

import { MOCK_GENERATE_MS, MOCK_QUEUE_MS } from '@/core/constants'
import type { UpaiJobKind, UpaiJobStatus, UpaiWaitingOn } from '@/core/protocol/upai'

import { globalState } from '../../global-state'
import type { JobRef } from '../types'
import { customMockFixtures } from './custom-fixtures'

const SLOW_FACTOR = 10

interface CustomMockJob {
  id: string
  instanceId: string
  kind: UpaiJobKind
  modelId: string
  prompt: string
  startedAt: number
  cancelledAt: number | null
}

export interface StartCustomMockJobParams {
  instanceId: string
  kind: UpaiJobKind
  modelId: string
  prompt: string
  startedAt?: number
}

export interface StartedCustomMockJob {
  jobId: string
  submittedAt: string
}

export interface CustomMockJobSnapshot {
  status: UpaiJobStatus
  percent: number
  node: string | null
  queuePosition: number | null
  waitingOn: UpaiWaitingOn | null
  error: string | null
  urls: readonly string[] | null
  usageCost: number
  expiresAt: number | null
}

interface DeletedCustomMockResult {
  jobId: string
  kind: UpaiJobKind
}

const jobs = globalState<Map<string, CustomMockJob>>('customMockJobs', () => {
  return new Map()
})

const deletedResults = globalState<DeletedCustomMockResult[]>('customMockDeletedResults', () => {
  return []
})

/** Called by the mock adapters so tests can assert the delete route. */
export function recordCustomMockDelete(job: JobRef, kind: UpaiJobKind): void {
  deletedResults.push({ jobId: job.jobId, kind })
}

export function deletedCustomMockResults(): readonly DeletedCustomMockResult[] {
  return deletedResults
}

export function __resetCustomMockDeletesForTests(): void {
  deletedResults.length = 0
}

export function startCustomMockJob(params: StartCustomMockJobParams): StartedCustomMockJob {
  const { instanceId, kind, modelId, prompt, startedAt = Date.now() } = params
  const jobId = randomUUID()

  jobs.set(jobId, { id: jobId, instanceId, kind, modelId, prompt, startedAt, cancelledAt: null })

  return { jobId, submittedAt: new Date(startedAt).toISOString() }
}

export function cancelCustomMockJob(job: JobRef): void {
  const stored = jobs.get(job.jobId)

  if (isNil(stored) || !isNil(stored.cancelledAt)) {
    return
  }

  stored.cancelledAt = Math.max(Date.now(), stored.startedAt)
}

export function customMockJobSnapshot(job: JobRef): CustomMockJobSnapshot {
  const stored = jobs.get(job.jobId) ?? restoredJob(job)
  const elapsed = Date.now() - stored.startedAt

  if (!isNil(stored.cancelledAt)) {
    return cancelledSnapshot(stored)
  }

  if (elapsed < MOCK_QUEUE_MS) {
    return pendingSnapshot(stored)
  }

  const finish = finishMs(stored.prompt)

  if (elapsed >= finish) {
    return doneSnapshot(stored)
  }

  return runningSnapshot(elapsed, finish)
}

function restoredJob(job: JobRef): CustomMockJob {
  const parsed = Date.parse(job.submittedAt)
  let startedAt = Date.now()

  if (Number.isFinite(parsed)) {
    startedAt = parsed
  }

  return {
    id: job.jobId,
    instanceId: 'restored',
    kind: 'video',
    modelId: '',
    prompt: '',
    startedAt,
    cancelledAt: null,
  }
}

function pendingSnapshot(job: CustomMockJob): CustomMockJobSnapshot {
  const fixtures = customMockFixtures()
  const isBusy = job.prompt.includes('[busy]')
  const fixturePosition = fixtures.jobs.pending.progress?.queue_position ?? 0
  const queuePosition = isBusy ? 1 : fixturePosition
  const waitingOn = isBusy ? 'comfyui_busy' : 'pack_queue'

  return {
    status: 'pending',
    percent: 0,
    node: null,
    queuePosition,
    waitingOn,
    error: null,
    urls: null,
    usageCost: 0,
    expiresAt: null,
  }
}

function runningSnapshot(elapsed: number, finish: number): CustomMockJobSnapshot {
  const percent = percentAt(elapsed, finish)

  return {
    status: 'in_progress',
    percent,
    node: samplerNode(),
    queuePosition: null,
    waitingOn: null,
    error: null,
    urls: null,
    usageCost: 0,
    expiresAt: null,
  }
}

function doneSnapshot(job: CustomMockJob): CustomMockJobSnapshot {
  const fixtures = customMockFixtures()

  if (job.prompt.includes('[fail]')) {
    return {
      status: 'failed',
      percent: fixtures.jobs.failed.progress?.percent ?? 50,
      node: samplerNode(),
      queuePosition: null,
      waitingOn: null,
      error: fixtures.jobs.failed.error ?? 'MockSampler: simulated failure',
      urls: null,
      usageCost: 0,
      expiresAt: null,
    }
  }

  return {
    status: 'completed',
    percent: 100,
    node: samplerNode(),
    queuePosition: null,
    waitingOn: null,
    error: null,
    urls: completedUrls(job.id),
    usageCost: fixtures.jobs.completed.usage.cost,
    expiresAt: null,
  }
}

function cancelledSnapshot(job: CustomMockJob): CustomMockJobSnapshot {
  const cancelElapsed = (job.cancelledAt ?? job.startedAt) - job.startedAt
  const isQueued = cancelElapsed < MOCK_QUEUE_MS
  let percent = 0
  let node: string | null = null

  if (!isQueued) {
    percent = percentAt(cancelElapsed, finishMs(job.prompt))
    node = samplerNode()
  }

  return {
    status: 'cancelled',
    percent,
    node,
    queuePosition: null,
    waitingOn: null,
    error: null,
    urls: null,
    usageCost: 0,
    expiresAt: null,
  }
}

function finishMs(prompt: string): number {
  if (prompt.includes('[fail]')) {
    return MOCK_QUEUE_MS + Math.floor(MOCK_GENERATE_MS / 2)
  }

  if (prompt.includes('[slow]')) {
    return MOCK_QUEUE_MS + MOCK_GENERATE_MS * SLOW_FACTOR
  }

  return MOCK_QUEUE_MS + MOCK_GENERATE_MS
}

function percentAt(elapsed: number, finish: number): number {
  const span = Math.max(finish - MOCK_QUEUE_MS, 1)
  const ratio = (elapsed - MOCK_QUEUE_MS) / span

  return Math.min(99, Math.max(0, Math.floor(ratio * 99)))
}

function samplerNode(): string {
  return customMockFixtures().jobs.inProgress.progress?.node ?? 'MockSampler'
}

function completedUrls(jobId: string): readonly string[] | null {
  const job = customMockFixtures().jobs.completed
  const [template] = job.urls ?? []

  if (isNil(template)) {
    return null
  }

  return [template.replace(job.id, jobId)]
}
