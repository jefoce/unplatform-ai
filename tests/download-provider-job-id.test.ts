import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { queueDownload as QueueDownload } from '@/server/jobs/download-queue'
import type { ContentRequest, JobSnapshot } from '@/server/providers/types'
import type {
  getGeneration as GetGeneration,
  saveGeneration as SaveGeneration,
} from '@/server/repos/generations'

import { storedRecord } from './helpers/stored-record'

const root = path.join(os.tmpdir(), `cf-provider-job-id-${process.pid}-${Date.now()}`)

process.env.STORAGE_ROOT = root

const provider = vi.hoisted(() => {
  const fetchContent = vi.fn<(request: ContentRequest) => Promise<Response>>()

  const getVideoProvider = vi.fn(() => {
    return { fetchContent }
  })

  return { fetchContent, getVideoProvider }
})

vi.mock('@/server/providers/registry', () => {
  return {
    getVideoProvider: provider.getVideoProvider,
  }
})

vi.mock('@/server/media/ffmpeg', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/server/media/ffmpeg')

  return {
    ...actual,
    probeMedia: async () => {
      return { durationSec: 1, width: 640, height: 360 }
    },
  }
})

const ID = '33333333-3333-4333-8333-333333333333'
const CUSTOM_ID = '44444444-4444-4444-8444-444444444444'
const REMOVED_ID = '55555555-5555-4555-8555-555555555555'
const PROVIDER_JOB_ID = 'or-job-4242'
const CUSTOM_JOB_ID = 'ep-job-4242'

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
let saveGeneration: typeof SaveGeneration

beforeAll(async () => {
  await fs.mkdir(root, { recursive: true })

  ;({ queueDownload } = await import('@/server/jobs/download-queue'))

  ;({ getGeneration, saveGeneration } = await import('@/server/repos/generations'))
})

beforeEach(() => {
  provider.getVideoProvider.mockClear()
})

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('download content', () => {
  it('fetches with the provider job id when urls is empty', async () => {
    provider.fetchContent.mockResolvedValue(new Response(new Uint8Array([0, 0, 0, 0])))

    const record = storedRecord(ID, {
      job: { id: PROVIDER_JOB_ID, submittedAt: '2026-01-01T00:00:00.000Z' },
    })

    await saveGeneration(record)
    await queueDownload(record, JOB)

    await vi.waitFor(
      async () => {
        const record = await getGeneration(ID)

        expect(record?.output?.video).toBe(`${ID}.mp4`)
      },
      { timeout: 5000 },
    )

    const request = provider.fetchContent.mock.calls[0]?.[0]

    expect(request?.job.jobId).toBe(PROVIDER_JOB_ID)
    expect(request?.job.jobId).not.toBe(ID)
    expect(provider.fetchContent).toHaveBeenCalledTimes(1)
  })

  it('resolves the custom endpoint instance', async () => {
    provider.fetchContent.mockResolvedValue(new Response(new Uint8Array([0, 0, 0, 0])))

    const record = storedRecord(CUSTOM_ID, {
      provider: 'custom',
      source: {
        kind: 'custom',
        instanceId: 'ep-custom',
        badge: 'CU1',
        presetTitle: 'Local Wan',
        workflowName: null,
        endpointLabel: 'Studio',
        local: true,
      },
      job: { id: CUSTOM_JOB_ID, submittedAt: '2026-01-01T00:00:00.000Z' },
    })

    await saveGeneration(record)
    await queueDownload(record, JOB)

    await vi.waitFor(
      async () => {
        const record = await getGeneration(CUSTOM_ID)

        expect(record?.output?.video).toBe(`${CUSTOM_ID}.mp4`)
      },
      { timeout: 5000 },
    )

    expect(provider.getVideoProvider).toHaveBeenCalledWith('ep-custom')
  })

  it('stores a removed endpoint error when the endpoint is gone', async () => {
    provider.getVideoProvider.mockImplementationOnce(() => {
      throw new Error('[unplatform-ai] unknown provider instance ep-gone')
    })

    const record = storedRecord(REMOVED_ID, {
      provider: 'custom',
      source: {
        kind: 'custom',
        instanceId: 'ep-gone',
        badge: 'CU1',
        presetTitle: 'Local Wan',
        workflowName: null,
        endpointLabel: 'Studio',
        local: true,
      },
      job: { id: CUSTOM_JOB_ID, submittedAt: '2026-01-01T00:00:00.000Z' },
    })

    await saveGeneration(record)
    await queueDownload(record, JOB)

    await vi.waitFor(
      async () => {
        const saved = await getGeneration(REMOVED_ID)

        expect(saved?.download).toBeUndefined()
        expect(saved?.error).toBe('Download failed: upai:endpoint_removed: Endpoint removed')
      },
      { timeout: 5000 },
    )
  })
})
