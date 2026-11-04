import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type {
  isDownloadQueued as IsDownloadQueued,
  queueDownload as QueueDownload,
} from '@/server/jobs/download-queue'
import type { JobSnapshot } from '@/server/providers/types'
import type {
  getGeneration as GetGeneration,
  saveGeneration as SaveGeneration,
} from '@/server/repos/generations'

import { isDownloadFailure } from '../src/core/download-failure'
import type { GenerationRecord } from '../src/core/schemas/generation-record'
import { storedRecord } from './helpers/stored-record'
import { waitFor } from './helpers/wait-for'

const root = path.join(os.tmpdir(), `cf-download-integrity-${process.pid}-${Date.now()}`)

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

  // Cold-start module loading stays out of the first test.
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

describe('download integrity', () => {
  it('fails a body shorter than the declared length', async () => {
    const startedAt = Date.now()

    console.log(`[download-integrity] start ${startedAt}`)

    const id = '11111111-1111-4111-8111-111111111111'
    const saved = record(id)

    fetchContent.mockResolvedValue(
      new Response(new Uint8Array([0, 0, 0, 0]), {
        headers: { 'content-length': '100' },
      }),
    )

    await saveGeneration(saved)
    await queueDownload(saved, JOB)

    console.log(`[download-integrity] queueDownload resolved +${Date.now() - startedAt} ms`)

    const failed = await waitForSettled(id)

    console.log(`[download-integrity] record settled +${Date.now() - startedAt} ms`)

    expect(failed.status).toBe('failed')
    expect(failed.error).toContain('Download failed:')
    expect(failed.output).toBeUndefined()
    expect(isDownloadFailure(failed)).toBe(true)
  })

  it('fails an HTML body that the probe cannot read', async () => {
    const id = '22222222-2222-4222-8222-222222222222'
    const saved = record(id)

    fetchContent.mockResolvedValue(new Response('<html>not a video</html>'))

    await saveGeneration(saved)
    await queueDownload(saved, JOB)

    const failed = await waitForSettled(id)

    expect(failed.status).toBe('failed')
    expect(failed.error).toContain('Download failed:')
    expect(failed.output).toBeUndefined()
    expect(isDownloadFailure(failed)).toBe(true)
  })

  it('completes a body the probe reads as video', async () => {
    const id = '33333333-3333-4333-8333-333333333333'
    const saved = record(id)

    fetchContent.mockResolvedValue(new Response(videoBytes))

    await saveGeneration(saved)
    await queueDownload(saved, JOB)

    const completed = await waitForSettled(id)

    expect(completed.status).toBe('completed')
    expect(completed.output?.video).toBe(`${id}.mp4`)
    expect(completed.error).toBeUndefined()
  })
})
