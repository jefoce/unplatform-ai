import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { GenerationRecord } from '../src/core/schemas/generation-record'
import { required } from './helpers/required'
import { storedRecord } from './helpers/stored-record'

const root = path.join(os.tmpdir(), `cf-download-boot-${process.pid}-${Date.now()}`)

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

const { queueDownload, downloadQueueIds, waitForDownloadsDone, stopDownloads } =
  await import('@/server/jobs/download-queue')

const { completedJob } = await import('@/server/jobs/download-resume')
const { getGeneration } = await import('@/server/repos/generations')

beforeAll(async () => {
  await fs.mkdir(path.join(root, 'downloads'), { recursive: true })
})

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

function markedRecord(id: string): GenerationRecord {
  return storedRecord(id, {
    status: 'completed',
    download: { startedAt: SUBMITTED_AT },
    job: { id: JOB_ID, submittedAt: SUBMITTED_AT },
  })
}

async function store(record: GenerationRecord): Promise<void> {
  await fs.writeFile(path.join(root, 'downloads', `${record.id}.json`), JSON.stringify(record))
}

describe('download marker after a crash', () => {
  it('re-queues every marked record at boot', async () => {
    const id = '66666666-6666-4666-8666-666666666666'

    fetchContent.mockResolvedValue(new Response(new Uint8Array([0, 0, 0, 0])))

    await store(markedRecord(id))

    const { reconcile } = await import('@/server/jobs/reconcile')

    await reconcile()

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

    expect(saved.status).toBe('completed')
    expect(saved.download).toBeUndefined()
  })

  it('keeps an active download counted until it finishes', async () => {
    const id = '77777777-7777-4777-8777-777777777777'
    const record = markedRecord(id)

    let release = (_response: Response): void => {}

    fetchContent.mockReturnValue(
      new Promise<Response>((resolve) => {
        release = resolve
      }),
    )

    await store(record)
    await queueDownload(record, completedJob(record))

    await vi.waitFor(() => {
      expect(downloadQueueIds()).toContain(id)
    })

    stopDownloads()

    expect(await waitForDownloadsDone(20)).toBe(false)

    release(new Response(new Uint8Array([0, 0, 0, 0])))

    expect(await waitForDownloadsDone(5000)).toBe(true)
    expect((await getGeneration(id))?.output?.video).toBe(`${id}.mp4`)
  })
})
