import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { COPY_EXPIRED_TEXT } from '@/core/provider-errors/app'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { JobSnapshot } from '@/server/providers/types'

import { required } from './helpers/required'
import { storedRecord } from './helpers/stored-record'

const root = path.join(os.tmpdir(), `upai-retry-download-${process.pid}-${Date.now()}`)

process.env.STORAGE_ROOT = root
delete process.env.APP_TOKEN

const queueDownload = vi.hoisted(() => {
  return vi.fn<(record: GenerationRecord, job: JobSnapshot) => Promise<void>>()
})

vi.mock('@/server/jobs/download-queue', () => {
  return { queueDownload }
})

vi.mock('@/server/session', () => {
  return {
    hasSession: () => {
      return true
    },
  }
})

const { POST } = await import('@/app/api/generations/[id]/download/route')
const { getGeneration } = await import('@/server/repos/generations')

const SUBMITTED_AT = '2026-01-01T00:00:00.000Z'

const retryRequest = (id: string): Request => {
  return new Request(`http://127.0.0.1:3000/api/generations/${id}/download`, {
    method: 'POST',
    headers: { host: '127.0.0.1:3000', 'sec-fetch-site': 'same-origin' },
  })
}

const context = (id: string) => {
  return { params: Promise.resolve({ id }) }
}

async function storeRecord(record: GenerationRecord): Promise<void> {
  await fs.writeFile(path.join(root, 'downloads', `${record.id}.json`), JSON.stringify(record))
}

beforeAll(async () => {
  await fs.mkdir(path.join(root, 'downloads'), { recursive: true })
})

beforeEach(() => {
  queueDownload.mockReset()
  queueDownload.mockResolvedValue(undefined)
})

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('POST /api/generations/[id]/download', () => {
  it('queues the provider copy and marks the record in progress', async () => {
    const id = randomUUID()
    const expiresAt = Date.now() + 60_000

    const record = storedRecord(id, {
      status: 'failed',
      error: 'Download failed: gone',
      download: { startedAt: SUBMITTED_AT },
      job: {
        id: 'or-job-4242',
        generationId: 'or-generation-1',
        submittedAt: SUBMITTED_AT,
        expiresAt,
      },
    })

    await storeRecord(record)

    const response = await POST(retryRequest(id), context(id))

    expect(response.status).toBe(204)

    const [saved, job] = required(queueDownload.mock.calls[0], 'queued download')

    expect(saved.status).toBe('in_progress')
    expect(saved.error).toBeUndefined()
    expect(saved.download).toBeUndefined()

    expect(job).toEqual({
      status: 'completed',
      generationId: 'or-generation-1',
      expiresAt,
      urls: null,
      usage: null,
      error: null,
    })

    const stored = await getGeneration(id)

    expect(stored?.status).toBe('in_progress')
    expect(stored?.error).toBeUndefined()
    expect(stored?.download).toBeUndefined()
  })

  it('returns 409 when the provider copy expired', async () => {
    const id = randomUUID()

    await storeRecord(
      storedRecord(id, {
        status: 'failed',
        error: 'Download failed: gone',
        job: { id: 'or-job-4242', submittedAt: SUBMITTED_AT, expiresAt: Date.now() - 1000 },
      }),
    )

    const response = await POST(retryRequest(id), context(id))

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: COPY_EXPIRED_TEXT })
    expect(queueDownload).not.toHaveBeenCalled()
    expect((await getGeneration(id))?.status).toBe('failed')
  })

  it('returns 409 when there is no provider job id', async () => {
    const id = randomUUID()

    await storeRecord(
      storedRecord(id, {
        status: 'failed',
        error: 'Download failed: gone',
        job: { id: '', submittedAt: SUBMITTED_AT },
      }),
    )

    const response = await POST(retryRequest(id), context(id))

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'This copy has no provider job' })
    expect(queueDownload).not.toHaveBeenCalled()
  })
})

describe('POST /api/generations/[id]/download for a provider failure', () => {
  it('returns 409 without queueing another download', async () => {
    const id = randomUUID()

    await storeRecord(
      storedRecord(id, {
        status: 'failed',
        error: 'Provider error: job expired',
        job: {
          id: 'or-job-4242',
          submittedAt: SUBMITTED_AT,
          expiresAt: Date.now() + 60_000,
        },
      }),
    )

    const response = await POST(retryRequest(id), context(id))

    expect(response.status).toBe(409)

    expect(await response.json()).toEqual({
      error: 'This generation did not fail while downloading',
    })

    expect(queueDownload).not.toHaveBeenCalled()
    expect((await getGeneration(id))?.status).toBe('failed')
  })
})
