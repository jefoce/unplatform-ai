import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { storedRecord } from './helpers/stored-record'

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-download-disk-'))

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

const { retryDownload } = await import('@/server/jobs/generation-actions')
const { getGeneration, saveGeneration } = await import('@/server/repos/generations')
const { downloadPaths } = await import('@/server/paths')

const SUBMITTED_AT = '2026-01-01T00:00:00.000Z'

beforeAll(async () => {
  await fs.mkdir(path.join(root, 'downloads'), { recursive: true })
})

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('retry with a committed video', () => {
  it('completes from disk when the provider link is gone', async () => {
    const id = '88888888-8888-4888-8888-888888888888'
    const video = downloadPaths(id).video

    fetchContent.mockRejectedValue(new Error('link gone'))

    await saveGeneration(
      storedRecord(id, {
        status: 'failed',
        error: 'Download failed: gone',
        downloadFailed: true,
        job: { id: 'or-job-4242', submittedAt: SUBMITTED_AT, expiresAt: Date.now() - 1000 },
      }),
    )

    await fs.writeFile(video, Buffer.from('committed-mp4'))

    expect(await retryDownload(id)).toBe('queued')

    await vi.waitFor(
      async () => {
        const record = await getGeneration(id)

        expect(record?.status).toBe('completed')
      },
      { timeout: 5000 },
    )

    expect(fetchContent).not.toHaveBeenCalled()
    expect((await getGeneration(id))?.output?.video).toBe(`${id}.mp4`)
  })
})
