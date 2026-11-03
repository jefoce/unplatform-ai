import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { GenerationRecord } from '../src/core/schemas/generation-record'
import { storedRecord } from './helpers/stored-record'

const root = path.join(os.tmpdir(), `cf-delete-download-${process.pid}-${Date.now()}`)

process.env.STORAGE_ROOT = root
process.env.APP_TOKEN = 'c'.repeat(64)

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

const { DELETE } = await import('@/app/api/generations/[id]/route')

const { queueDownload, waitForDownloadsDone } = await import('@/server/jobs/download-queue')
const { completedJob } = await import('@/server/jobs/download-resume')
const { deleteGenerationFiles, getGeneration } = await import('@/server/repos/generations')

beforeAll(async () => {
  await fs.mkdir(path.join(root, 'downloads'), { recursive: true })
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

async function store(value: GenerationRecord): Promise<void> {
  await fs.writeFile(path.join(root, 'downloads', `${value.id}.json`), JSON.stringify(value))
}

function deleteRequest(id: string): Request {
  return new Request(`http://127.0.0.1:3000/api/generations/${id}`, {
    method: 'DELETE',
    headers: {
      host: '127.0.0.1:3000',
      cookie: `upai_session=${process.env.APP_TOKEN}`,
      'sec-fetch-site': 'same-origin',
    },
  })
}

interface GatedDownload {
  release: (response: Response) => void
  started: Promise<void>
}

function gateFetch(id: string): GatedDownload {
  let release = (_response: Response): void => {}

  fetchContent.mockReturnValue(
    new Promise<Response>((resolve) => {
      release = resolve
    }),
  )

  return {
    release,
    started: (async () => {
      await vi.waitFor(async () => {
        const current = await getGeneration(id)

        expect(current?.download).toBeDefined()
      })
    })(),
  }
}

describe('delete during a download', () => {
  it('returns 409 and keeps the record while the download runs', async () => {
    const id = '88888888-8888-4888-8888-888888888888'
    const value = record(id)

    await store(value)
    const gate = gateFetch(id)

    await queueDownload(value, completedJob(value))
    await gate.started

    const response = await DELETE(deleteRequest(id), { params: Promise.resolve({ id }) })

    expect(response.status).toBe(409)

    gate.release(new Response(new Uint8Array([0, 0, 0, 0])))

    expect(await waitForDownloadsDone(5000)).toBe(true)
    expect((await getGeneration(id))?.output?.video).toBe(`${id}.mp4`)
  })

  it('does not resurrect a record removed while the download runs', async () => {
    const id = '99999999-9999-4999-8999-999999999999'
    const value = record(id)

    await store(value)
    const gate = gateFetch(id)

    await queueDownload(value, completedJob(value))
    await gate.started

    await deleteGenerationFiles(id)
    gate.release(new Response(new Uint8Array([0, 0, 0, 0])))

    expect(await waitForDownloadsDone(5000)).toBe(true)
    expect(await getGeneration(id)).toBeNull()

    const json = await fs.stat(path.join(root, 'downloads', `${id}.json`)).catch(() => {
      return null
    })

    expect(json).toBeNull()
  })
})
