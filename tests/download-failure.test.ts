import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import type {
  isDownloadQueued as IsDownloadQueued,
  queueDownload as QueueDownload,
} from '@/server/jobs/download-queue'
import type { JobSnapshot } from '@/server/providers/types'
import type {
  getGeneration as GetGeneration,
  saveGeneration as SaveGeneration,
} from '@/server/repos/generations'

import { MAX_DOWNLOAD_RETRIES } from '../src/core/constants'
import { isDownloadFailure } from '../src/core/download-failure'
import type { GenerationRecord } from '../src/core/schemas/generation-record'
import { required } from './helpers/required'
import { storedRecord } from './helpers/stored-record'
import { waitFor } from './helpers/wait-for'

const root = path.join(os.tmpdir(), `cf-download-failure-${process.pid}-${Date.now()}`)

process.env.STORAGE_ROOT = root

const fetchContent = vi.hoisted(() => {
  return vi.fn<() => Promise<Response>>()
})

interface PreviewModule {
  makePreview: (params: { id: string; video: string; out: string }) => Promise<string | undefined>
}

const preview = vi.hoisted(() => {
  return { fail: false }
})

vi.mock('@/server/media/preview', async () => {
  const actual = await vi.importActual<PreviewModule>('@/server/media/preview')

  return {
    makePreview: async (params: { id: string; video: string; out: string }) => {
      if (preview.fail) {
        throw new Error('preview failed')
      }

      return actual.makePreview(params)
    },
  }
})

vi.mock('@/server/providers/registry', () => {
  return {
    getVideoProvider: () => {
      return { fetchContent }
    },
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

const JOB: JobSnapshot = {
  status: 'completed',
  generationId: null,
  expiresAt: null,
  urls: [],
  usage: null,
  error: null,
}

const JOB_ID = 'or-job-4242'
const SUBMITTED_AT = '2026-01-01T00:00:00.000Z'

let queueDownload: typeof QueueDownload
let isDownloadQueued: typeof IsDownloadQueued
let getGeneration: typeof GetGeneration
let saveGeneration: typeof SaveGeneration

beforeAll(async () => {
  await fs.mkdir(root, { recursive: true })

  ;({ queueDownload, isDownloadQueued } = await import('@/server/jobs/download-queue'))

  ;({ getGeneration, saveGeneration } = await import('@/server/repos/generations'))
})

afterEach(() => {
  preview.fail = false
})

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('download failure flag', () => {
  it('sets downloadFailed when the retry budget runs out', async () => {
    const id = '44444444-4444-4444-8444-444444444444'
    const job = { id: JOB_ID, submittedAt: SUBMITTED_AT }

    fetchContent.mockRejectedValue(new Error('gone'))

    let saved = storedRecord(id, { status: 'in_progress', job })

    await saveGeneration(saved)

    for (let attempt = 1; attempt <= MAX_DOWNLOAD_RETRIES; attempt += 1) {
      await queueDownload(saved, JOB)

      saved = await waitForFailure(id)
    }

    expect(saved.status).toBe('failed')
    expect(saved.downloadFailed).toBe(true)
    expect(isDownloadFailure(saved)).toBe(true)
  })

  it('keeps the video when the poster step fails', async () => {
    const id = '66666666-6666-4666-8666-666666666666'
    const job = { id: JOB_ID, submittedAt: SUBMITTED_AT }

    fetchContent.mockResolvedValue(new Response(new Uint8Array([0, 0, 0, 0])))
    preview.fail = true

    const saved = storedRecord(id, { status: 'in_progress', job })

    await saveGeneration(saved)
    await queueDownload(saved, JOB)

    const completed = required(
      await vi.waitFor(
        async () => {
          const current = await getGeneration(id)

          expect(current?.status).toBe('completed')

          return current
        },
        { timeout: 5000 },
      ),
      'saved record',
    )

    expect(completed.download).toBeUndefined()
    expect(completed.output?.preview).toBeNull()
    expect(completed.previewPending).toBe(false)
    expect(completed.error).toBeUndefined()
  })

  it('clears downloadFailed when the retry succeeds', async () => {
    const id = '55555555-5555-4555-8555-555555555555'

    fetchContent.mockResolvedValue(new Response(new Uint8Array([0, 0, 0, 0])))

    const record = storedRecord(id, {
      status: 'in_progress',
      downloadFailed: true,
      error: undefined,
      job: { id: JOB_ID, submittedAt: SUBMITTED_AT },
    })

    await saveGeneration(record)
    await queueDownload(record, JOB)

    const saved = required(
      await vi.waitFor(
        async () => {
          const current = await getGeneration(id)

          expect(current?.output?.video).toBe(`${id}.mp4`)

          return current
        },
        { timeout: 5000 },
      ),
      'saved record',
    )

    expect(saved.downloadFailed).toBeUndefined()
    expect(saved.error).toBeUndefined()
    expect(isDownloadFailure(saved)).toBe(false)
  })
})

async function waitForFailure(id: string): Promise<GenerationRecord> {
  return waitFor(async () => {
    const current = await getGeneration(id)
    const isFailed = current?.error?.startsWith('Download failed:') === true

    if (current && !current.download && isFailed && !isDownloadQueued(id)) {
      return current
    }

    return null
  })
}
