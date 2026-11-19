import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProviderError, type ProviderErrorKind } from '@/server/providers/provider-error'
import type { JobSnapshot } from '@/server/providers/types'

import { MAX_JOB_AGE_MIN } from '../src/core/constants'
import type { GenerationRecord } from '../src/core/schemas/generation-record'
import { required } from './helpers/required'
import { storedRecord } from './helpers/stored-record'

const root = path.join(os.tmpdir(), `cf-poll-expiry-${process.pid}-${Date.now()}`)

process.env.STORAGE_ROOT = root

const getJob = vi.hoisted(() => {
  return vi.fn<() => Promise<JobSnapshot>>()
})

const queueDownload = vi.hoisted(() => {
  return vi.fn<(record: GenerationRecord, job: JobSnapshot) => Promise<void>>()
})

vi.mock('@/server/providers/registry', () => {
  return {
    getVideoProvider: () => {
      return { getJob }
    },
  }
})

vi.mock('@/server/jobs/download-queue', () => {
  return { queueDownload }
})

const SUBMITTED_AT = '2026-01-01T00:00:00.000Z'
const ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const { processRecord } = await import('@/server/jobs/poll-record')
const { getActiveCount, getGeneration, saveGeneration } = await import('@/server/repos/generations')

beforeAll(async () => {
  await fs.mkdir(path.join(root, 'downloads'), { recursive: true })
})

beforeEach(() => {
  getJob.mockReset()
  queueDownload.mockReset()
  queueDownload.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

function snapshot(status: JobSnapshot['status']): JobSnapshot {
  return {
    status,
    generationId: null,
    expiresAt: null,
    urls: null,
    usage: null,
    error: null,
  }
}

async function agedRecord(ageMin: number): Promise<GenerationRecord> {
  const createdAt = new Date(Date.now() - ageMin * 60_000).toISOString()

  const record = storedRecord(ID, {
    createdAt,
    status: 'pending',
    job: { id: 'or-job-4242', submittedAt: SUBMITTED_AT },
  })

  await saveGeneration(record)

  return record
}

/**
 * Moves the clock past the bound as the first poll returns.
 * This is the record that ages out during a tick.
 */
function ageAfterFirstPoll(first: JobSnapshot): void {
  const start = Date.now()
  const now = vi.spyOn(Date, 'now').mockReturnValue(start)

  getJob.mockImplementationOnce(async () => {
    now.mockReturnValue(start + 2 * 60_000)

    return first
  })
}

/**
 * A provider failure with only the kind set.
 * The poll branches on kind alone.
 */
function providerFailure(kind: ProviderErrorKind): ProviderError {
  return new ProviderError({
    providerId: 'openrouter',
    kind,
    message: `poll failed: ${kind}`,
    storedMessage: `poll failed: ${kind}`,
    status: 500,
    code: null,
  })
}

describe('aged job cutoff', () => {
  it('polls once more before expiring', async () => {
    const record = await agedRecord(MAX_JOB_AGE_MIN - 1)

    ageAfterFirstPoll(snapshot('pending'))
    getJob.mockResolvedValueOnce(snapshot('pending'))

    await processRecord(record)

    expect(getJob).toHaveBeenCalledTimes(2)
    expect((await getGeneration(ID))?.status).toBe('expired')
  })

  it('downloads a job the final poll reports completed', async () => {
    const record = await agedRecord(MAX_JOB_AGE_MIN - 1)

    ageAfterFirstPoll(snapshot('pending'))
    getJob.mockResolvedValueOnce(snapshot('completed'))

    await processRecord(record)

    expect(getJob).toHaveBeenCalledTimes(2)
    expect(queueDownload).toHaveBeenCalledTimes(1)

    const [saved, job] = required(queueDownload.mock.calls[0], 'queued download')

    expect(saved.status).toBe('in_progress')
    expect(saved.download).toBeDefined()
    expect(job.status).toBe('completed')
    expect((await getGeneration(ID))?.status).toBe('in_progress')
  })
})

describe('failed polls at the age cutoff', () => {
  it('expires a record whose poll always fails', async () => {
    const record = await agedRecord(MAX_JOB_AGE_MIN + 60)

    getJob.mockRejectedValue(providerFailure('server'))

    await processRecord(record)

    const saved = await getGeneration(ID)

    expect(saved?.status).toBe('expired')
    expect(await getActiveCount()).toBe(0)
  })

  it('checks the age before the provider call', async () => {
    const record = await agedRecord(MAX_JOB_AGE_MIN + 60)

    getJob.mockRejectedValue(providerFailure('auth'))

    await processRecord(record)

    const saved = await getGeneration(ID)

    expect(getJob).not.toHaveBeenCalled()
    expect(saved?.status).toBe('expired')
  })
})
