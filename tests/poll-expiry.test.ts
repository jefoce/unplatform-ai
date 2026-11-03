import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

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
const { getGeneration, saveGeneration } = await import('@/server/repos/generations')

beforeAll(async () => {
  await fs.mkdir(path.join(root, 'downloads'), { recursive: true })
})

beforeEach(() => {
  getJob.mockReset()
  queueDownload.mockReset()
  queueDownload.mockResolvedValue(undefined)
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

async function agedRecord(): Promise<GenerationRecord> {
  const createdAt = new Date(Date.now() - (MAX_JOB_AGE_MIN + 30) * 60_000).toISOString()

  const record = storedRecord(ID, {
    createdAt,
    status: 'pending',
    job: { id: 'or-job-4242', submittedAt: SUBMITTED_AT },
  })

  await saveGeneration(record)

  return record
}

describe('aged job cutoff', () => {
  it('polls once more before expiring', async () => {
    const record = await agedRecord()

    getJob.mockResolvedValueOnce(snapshot('pending')).mockResolvedValueOnce(snapshot('pending'))

    await processRecord(record)

    expect(getJob).toHaveBeenCalledTimes(2)
    expect((await getGeneration(ID))?.status).toBe('expired')
  })

  it('downloads a job the final poll reports completed', async () => {
    const record = await agedRecord()

    getJob.mockResolvedValueOnce(snapshot('pending')).mockResolvedValueOnce(snapshot('completed'))

    await processRecord(record)

    expect(getJob).toHaveBeenCalledTimes(2)
    expect(queueDownload).toHaveBeenCalledTimes(1)

    const [saved, job] = required(queueDownload.mock.calls[0], 'queued download')

    expect(saved.status).toBe('completed')
    expect(job.status).toBe('completed')
    expect((await getGeneration(ID))?.status).toBe('completed')
  })
})
