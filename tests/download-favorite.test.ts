import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { GenerationRecord } from '../src/core/schemas/generation-record'
import { storedRecord } from './helpers/stored-record'

const root = path.join(os.tmpdir(), `cf-download-favorite-${process.pid}-${Date.now()}`)

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

const SUBMITTED_AT = '2026-01-01T00:00:00.000Z'
const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const { queueDownload, waitForDownloadsDone } = await import('@/server/jobs/download-queue')
const { completedJob } = await import('@/server/jobs/download-resume')
const { setFavorite } = await import('@/server/jobs/generation-actions')
const { getGeneration } = await import('@/server/repos/generations')

beforeAll(async () => {
  await fs.mkdir(path.join(root, 'downloads'), { recursive: true })
})

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

function record(): GenerationRecord {
  return storedRecord(ID, {
    status: 'in_progress',
    favorite: false,
    job: { id: 'or-job-4242', submittedAt: SUBMITTED_AT },
  })
}

describe('favorite during a download', () => {
  it('keeps a favorite toggled while the download runs', async () => {
    const value = record()

    let release = (_response: Response): void => {}

    fetchContent.mockReturnValue(
      new Promise<Response>((resolve) => {
        release = resolve
      }),
    )

    await fs.writeFile(path.join(root, 'downloads', `${ID}.json`), JSON.stringify(value))
    await queueDownload(value, completedJob(value))

    await vi.waitFor(async () => {
      expect((await getGeneration(ID))?.download).toBeDefined()
    })

    await setFavorite(ID, true)
    release(new Response(new Uint8Array([0, 0, 0, 0])))

    expect(await waitForDownloadsDone(5000)).toBe(true)

    const saved = await getGeneration(ID)

    expect(saved?.favorite).toBe(true)
    expect(saved?.output?.video).toBe(`${ID}.mp4`)
    expect(saved?.download).toBeUndefined()
  })
})
