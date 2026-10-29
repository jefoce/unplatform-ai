import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { queueDownload as QueueDownload } from '@/server/jobs/download-queue'
import type { ContentRequest, JobSnapshot } from '@/server/providers/types'
import type { getGeneration as GetGeneration } from '@/server/repos/generations'

import { storedRecord } from './helpers/stored-record'

const root = path.join(os.tmpdir(), `upai-provider-job-id-${process.pid}-${Date.now()}`)

process.env.STORAGE_ROOT = root

const fetchContent = vi.hoisted(() => {
  return vi.fn<(request: ContentRequest) => Promise<Response>>()
})

vi.mock('@/server/providers/registry', () => {
  return {
    getVideoProvider: () => {
      return { fetchContent }
    },
  }
})

const ID = '33333333-3333-4333-8333-333333333333'
const PROVIDER_JOB_ID = 'or-job-4242'

const JOB: JobSnapshot = {
  status: 'completed',
  generationId: null,
  expiresAt: null,
  urls: [],
  usage: null,
  error: null,
}

let queueDownload: typeof QueueDownload
let getGeneration: typeof GetGeneration

beforeAll(async () => {
  await fs.mkdir(root, { recursive: true })

  ;({ queueDownload } = await import('@/server/jobs/download-queue'))

  ;({ getGeneration } = await import('@/server/repos/generations'))
})

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('download content', () => {
  it('fetches with the provider job id when urls is empty', async () => {
    fetchContent.mockResolvedValue(new Response(new Uint8Array([0, 0, 0, 0])))

    await queueDownload(
      storedRecord(ID, {
        job: { id: PROVIDER_JOB_ID, submittedAt: '2026-01-01T00:00:00.000Z' },
      }),
      JOB,
    )

    await vi.waitFor(
      async () => {
        const record = await getGeneration(ID)

        expect(record?.output?.video).toBe(`${ID}.mp4`)
      },
      { timeout: 5000 },
    )

    const request = fetchContent.mock.calls[0]?.[0]

    expect(request?.job.jobId).toBe(PROVIDER_JOB_ID)
    expect(request?.job.jobId).not.toBe(ID)
    expect(fetchContent).toHaveBeenCalledTimes(1)
  })
})
