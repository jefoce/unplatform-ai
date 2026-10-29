import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { MAX_DOWNLOAD_RETRIES } from '@/core/constants'
import { isDownloadFailure } from '@/core/download-failure'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { queueDownload as QueueDownload } from '@/server/jobs/download-queue'
import type { JobSnapshot } from '@/server/providers/types'
import type { getGeneration as GetGeneration } from '@/server/repos/generations'

import { required } from './helpers/required'
import { storedRecord } from './helpers/stored-record'

const root = path.join(os.tmpdir(), `upai-download-failure-${process.pid}-${Date.now()}`)

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

const JOB_ID = 'or-job-4242'
const SUBMITTED_AT = '2026-01-01T00:00:00.000Z'

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

describe('download failure flag', () => {
  it('sets downloadFailed when the retry budget runs out', async () => {
    const id = '44444444-4444-4444-8444-444444444444'
    const job = { id: JOB_ID, submittedAt: SUBMITTED_AT }

    fetchContent.mockRejectedValue(new Error('gone'))

    let saved = storedRecord(id, { status: 'in_progress', job })

    for (let attempt = 1; attempt <= MAX_DOWNLOAD_RETRIES; attempt += 1) {
      await queueDownload(saved, JOB)

      saved = await waitForFailure(id)
    }

    expect(saved.status).toBe('failed')
    expect(saved.downloadFailed).toBe(true)
    expect(isDownloadFailure(saved)).toBe(true)
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
  const deadline = Date.now() + 5000

  while (Date.now() < deadline) {
    const current = await getGeneration(id)
    const isFailed = current?.error?.startsWith('Download failed:') === true

    if (current && !current.download && isFailed) {
      return current
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 20)
    })
  }

  throw new Error('Timed out waiting for the failed download')
}
