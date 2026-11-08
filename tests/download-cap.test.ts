import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  isDownloadQueued as IsDownloadQueued,
  queueDownload as QueueDownload,
} from '@/server/jobs/download-queue'
import type { JobSnapshot } from '@/server/providers/types'
import type {
  getGeneration as GetGeneration,
  saveGeneration as SaveGeneration,
} from '@/server/repos/generations'

import { CUSTOM_VIDEO_MAX_BYTES } from '../src/core/constants'
import type { GenerationRecord } from '../src/core/schemas/generation-record'
import { storedRecord } from './helpers/stored-record'
import { waitFor } from './helpers/wait-for'

vi.mock('@/core/constants', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/core/constants')

  return { ...actual, CUSTOM_VIDEO_MAX_BYTES: 32 * 1024 }
})

const root = path.join(os.tmpdir(), `cf-download-cap-${process.pid}-${Date.now()}`)

process.env.STORAGE_ROOT = root

const fetchContent = vi.hoisted(() => {
  return vi.fn<() => Promise<Response>>()
})

vi.mock('@/server/providers/registry', () => {
  return {
    getVideoProvider: () => {
      return { fetchContent }
    },
  }
})

const JOB: JobSnapshot = {
  status: 'completed',
  generationId: null,
  expiresAt: null,
  urls: [],
  usage: null,
  error: null,
}

const SUBMITTED_AT = '2026-01-01T00:00:00.000Z'

let queueDownload: typeof QueueDownload
let isDownloadQueued: typeof IsDownloadQueued
let getGeneration: typeof GetGeneration
let saveGeneration: typeof SaveGeneration
let videoBytes: ArrayBuffer

beforeAll(async () => {
  await fs.mkdir(root, { recursive: true })

  await import('sharp')
  await import('@/server/media/ffmpeg')

  const file = await fs.readFile(path.join(process.cwd(), 'tests/fixtures/media/sample.mp4'))

  videoBytes = new ArrayBuffer(file.byteLength)

  new Uint8Array(videoBytes).set(file)

  const downloads = await import('@/server/jobs/download-queue')
  const generations = await import('@/server/repos/generations')

  queueDownload = downloads.queueDownload
  isDownloadQueued = downloads.isDownloadQueued
  getGeneration = generations.getGeneration
  saveGeneration = generations.saveGeneration
})

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

beforeEach(() => {
  fetchContent.mockReset()
})

function record(id: string): GenerationRecord {
  return storedRecord(id, {
    status: 'in_progress',
    job: { id: 'or-job-4242', submittedAt: SUBMITTED_AT },
  })
}

async function waitForSettled(id: string): Promise<GenerationRecord> {
  return waitFor(async () => {
    const current = await getGeneration(id)

    if (current && !current.download && !isDownloadQueued(id) && current.output) {
      return current
    }

    if (current?.status === 'failed' && !current.download && !isDownloadQueued(id)) {
      return current
    }

    return null
  })
}

async function runDownload(id: string, response: Response): Promise<GenerationRecord> {
  const saved = record(id)

  fetchContent.mockResolvedValue(response)

  await saveGeneration(saved)
  await queueDownload(saved, JOB)

  return waitForSettled(id)
}

describe('custom video download cap', () => {
  it('fails a declared body over the cap before writing', async () => {
    const failed = await runDownload(
      '44444444-4444-4444-8444-444444444444',
      new Response(new Uint8Array([0]), {
        headers: { 'content-length': String(CUSTOM_VIDEO_MAX_BYTES + 1) },
      }),
    )

    expect(failed.status).toBe('failed')
    expect(failed.error).toContain('Video is larger than the limit')
    expect(failed.output).toBeUndefined()
  })

  it('fails a streamed body once it passes the cap', async () => {
    const failed = await runDownload(
      '55555555-5555-4555-8555-555555555555',
      new Response(new Uint8Array(CUSTOM_VIDEO_MAX_BYTES + 1)),
    )

    expect(failed.status).toBe('failed')
    expect(failed.error).toContain('Video is larger than the limit')
    expect(failed.output).toBeUndefined()
  })

  it('completes a body under the cap', async () => {
    const completed = await runDownload(
      '66666666-6666-4666-8666-666666666666',
      new Response(videoBytes),
    )

    expect(completed.status).toBe('completed')
    expect(completed.output?.video).toBe('66666666-6666-4666-8666-666666666666.mp4')
    expect(completed.error).toBeUndefined()
  })
})
