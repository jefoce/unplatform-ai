import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { queueDownload as QueueDownload } from '@/server/jobs/download-queue'
import type { ContentRequest, JobSnapshot } from '@/server/providers/types'
import type {
  getGeneration as GetGeneration,
  saveGeneration as SaveGeneration,
} from '@/server/repos/generations'

import { storedRecord } from './helpers/stored-record'

const root = path.join(os.tmpdir(), `cf-download-fallback-host-${process.pid}-${Date.now()}`)

process.env.STORAGE_ROOT = root

interface SafeFetchParams {
  url: string
  hosts: readonly string[]
  timeoutMs: number
}

const mocks = vi.hoisted(() => {
  const fetchContent = vi.fn<(request: ContentRequest) => Promise<Response>>()
  const safeFetch = vi.fn<(params: SafeFetchParams) => Promise<Response>>()
  const videoProvider = { fetchContent, contentHosts: [] as readonly string[] }

  const getVideoProvider = vi.fn(() => {
    return videoProvider
  })

  return {
    fetchContent,
    safeFetch,
    videoProvider,
    getVideoProvider,
    endpoints: new Set<string>(),
  }
})

vi.mock('@/server/providers/registry', () => {
  return { getVideoProvider: mocks.getVideoProvider }
})

vi.mock('@/server/providers/custom/endpoint-source', () => {
  return {
    getEndpointSync: (id: string) => {
      return mocks.endpoints.has(id) ? { id } : null
    },
  }
})

vi.mock('@/server/providers/safe-fetch', () => {
  return { safeFetchProviderUrl: mocks.safeFetch }
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

const JOB_ID = 'or-job-4242'
const SUBMITTED_AT = '2026-01-01T00:00:00.000Z'
const VIDEO_URL = 'https://content.example/video.mp4'

const JOB: JobSnapshot = {
  status: 'completed',
  generationId: null,
  expiresAt: null,
  urls: [VIDEO_URL],
  usage: null,
  error: null,
}

function customRecord(id: string, instanceId: string): GenerationRecord {
  return storedRecord(id, {
    provider: 'custom',
    source: {
      kind: 'custom',
      instanceId,
      badge: 'CU1',
      presetTitle: 'Local Wan',
      workflowName: null,
      endpointLabel: 'Studio',
      local: true,
    },
    job: { id: JOB_ID, submittedAt: SUBMITTED_AT },
  })
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
  mocks.fetchContent.mockReset()
  mocks.getVideoProvider.mockReset()

  mocks.getVideoProvider.mockImplementation(() => {
    return mocks.videoProvider
  })

  mocks.safeFetch.mockReset()

  mocks.safeFetch.mockImplementation(async () => {
    return new Response(new Uint8Array([0, 0, 0, 0]))
  })

  mocks.endpoints.clear()
  mocks.videoProvider.contentHosts = []
})

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('download url fallback', () => {
  it('does not fetch a job url when the custom endpoint was removed', async () => {
    const id = '77777777-7777-4777-8777-777777777777'

    mocks.getVideoProvider.mockImplementation(() => {
      throw new Error('[unplatform-ai] unknown provider instance ep-gone')
    })

    const record = customRecord(id, 'ep-gone')

    await saveGeneration(record)
    await queueDownload(record, JOB)

    await vi.waitFor(
      async () => {
        const saved = await getGeneration(id)

        expect(saved?.error).toBe('Download failed: upai:endpoint_removed: Endpoint removed')
      },
      { timeout: 5000 },
    )

    expect(mocks.safeFetch).not.toHaveBeenCalled()
  })

  it('fetches a job url through safe fetch for a non-custom provider', async () => {
    const id = '88888888-8888-4888-8888-888888888888'

    mocks.fetchContent.mockRejectedValue(new Error('content gone'))
    mocks.videoProvider.contentHosts = ['content.example']

    const record = storedRecord(id, { job: { id: JOB_ID, submittedAt: SUBMITTED_AT } })

    await saveGeneration(record)
    await queueDownload(record, JOB)

    await vi.waitFor(
      async () => {
        const saved = await getGeneration(id)

        expect(saved?.output?.video).toBe(`${id}.mp4`)
      },
      { timeout: 5000 },
    )

    expect(mocks.safeFetch).toHaveBeenCalledWith({
      url: VIDEO_URL,
      hosts: ['content.example'],
      timeoutMs: expect.any(Number),
    })
  })

  it('uses the live custom endpoint content hosts for a job url', async () => {
    const id = '99999999-9999-4999-8999-999999999999'

    mocks.fetchContent.mockRejectedValue(new Error('content gone'))
    mocks.videoProvider.contentHosts = ['studio.example']
    mocks.endpoints.add('ep-live')

    const record = customRecord(id, 'ep-live')

    await saveGeneration(record)
    await queueDownload(record, JOB)

    await vi.waitFor(
      async () => {
        const saved = await getGeneration(id)

        expect(saved?.output?.video).toBe(`${id}.mp4`)
      },
      { timeout: 5000 },
    )

    expect(mocks.safeFetch).toHaveBeenCalledWith({
      url: VIDEO_URL,
      hosts: ['studio.example'],
      timeoutMs: expect.any(Number),
    })
  })
})
