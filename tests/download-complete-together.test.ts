import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { JobSnapshot } from '@/server/providers/types'

import { required } from './helpers/required'
import { storedRecord } from './helpers/stored-record'

const root = path.join(os.tmpdir(), `cf-complete-together-${process.pid}-${Date.now()}`)

process.env.STORAGE_ROOT = root

const repo = vi.hoisted(() => {
  return { records: new Map<string, GenerationRecord>(), saves: [] as GenerationRecord[] }
})

const fetchContent = vi.hoisted(() => {
  return vi.fn<() => Promise<Response>>()
})

const preview = vi.hoisted(() => {
  return { isFailing: false }
})

function saveRecord(record: GenerationRecord): GenerationRecord {
  const saved = { ...record, updatedAt: new Date().toISOString() }

  repo.records.set(saved.id, saved)
  repo.saves.push(structuredClone(saved))

  return saved
}

vi.mock('@/server/repos/generations', () => {
  return {
    getGeneration: async (id: string) => {
      return repo.records.get(id) ?? null
    },
    saveGeneration: async (record: GenerationRecord) => {
      return saveRecord(record)
    },
    updateGeneration: async (
      id: string,
      patch: (record: GenerationRecord) => GenerationRecord | null,
    ) => {
      const current = repo.records.get(id)

      if (!current) {
        return null
      }

      const next = patch(current)

      return next ? saveRecord(next) : null
    },
    listGenerations: async () => {
      return [...repo.records.values()]
    },
    listActiveGenerations: async () => {
      return []
    },
    getActiveCount: async () => {
      return 0
    },
    deleteGenerationFiles: async (id: string) => {
      repo.records.delete(id)
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

vi.mock('@/server/media/preview', () => {
  return {
    makePreview: async (params: { id: string }) => {
      if (preview.isFailing) {
        throw new Error('preview failed')
      }

      return `${params.id}.preview.webp`
    },
  }
})

const JOB: JobSnapshot = {
  status: 'completed',
  generationId: null,
  expiresAt: null,
  urls: null,
  usage: null,
  error: null,
}

const JOB_ID = 'or-job-4242'
const SUBMITTED_AT = '2026-01-01T00:00:00.000Z'

const { queueDownload, waitForDownloadsDone } = await import('@/server/jobs/download-queue')
const { resumeMarkedDownloads } = await import('@/server/jobs/download-resume')
const { retryDownload } = await import('@/server/jobs/generation-actions')
const { downloadPaths } = await import('@/server/paths')

beforeAll(async () => {
  await fs.mkdir(path.join(root, 'downloads'), { recursive: true })
})

beforeEach(() => {
  repo.records.clear()
  repo.saves.length = 0
  fetchContent.mockReset()
  preview.isFailing = false
})

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

function completedSaves(id: string): GenerationRecord[] {
  return repo.saves.filter((record) => {
    return record.id === id && record.status === 'completed'
  })
}

function assertCompletedTogether(id: string): void {
  const completed = completedSaves(id)

  expect(completed).toHaveLength(1)
  expect(completed[0]?.output?.video).toBe(`${id}.mp4`)
  expect(completed[0]?.output?.preview).toBe(`${id}.preview.webp`)
  expect(completed[0]?.previewPending).toBe(false)
}

async function store(record: GenerationRecord): Promise<void> {
  repo.records.set(record.id, record)
}

function markerRecord(id: string): GenerationRecord {
  return storedRecord(id, {
    status: 'in_progress',
    download: { startedAt: SUBMITTED_AT },
    job: { id: JOB_ID, submittedAt: SUBMITTED_AT },
  })
}

describe('completed and the preview in one save', () => {
  it('normal download', async () => {
    const id = '11111111-1111-4111-8111-111111111111'
    const record = markerRecord(id)

    fetchContent.mockResolvedValue(new Response(new Uint8Array([0, 0, 0, 0])))
    await store(record)
    await queueDownload(record, JOB)

    expect(await waitForDownloadsDone(5000)).toBe(true)
    assertCompletedTogether(id)
  })

  it('already-downloaded file', async () => {
    const id = '22222222-2222-4222-8222-222222222222'
    const record = markerRecord(id)

    await fs.writeFile(downloadPaths(id).video, Buffer.from('committed-mp4'))
    await store(record)
    await queueDownload(record, JOB)

    expect(await waitForDownloadsDone(5000)).toBe(true)
    expect(fetchContent).not.toHaveBeenCalled()
    assertCompletedTogether(id)
  })

  it('retryDownload', async () => {
    const id = '33333333-3333-4333-8333-333333333333'

    const record = storedRecord(id, {
      status: 'failed',
      error: 'Download failed: gone',
      downloadFailed: true,
      job: { id: JOB_ID, submittedAt: SUBMITTED_AT, expiresAt: Date.now() + 60_000 },
    })

    fetchContent.mockResolvedValue(new Response(new Uint8Array([0, 0, 0, 0])))
    await store(record)

    expect(await retryDownload(id)).toBe('queued')
    expect(await waitForDownloadsDone(5000)).toBe(true)
    assertCompletedTogether(id)
  })

  it('resumeMarkedDownloads', async () => {
    const id = '44444444-4444-4444-8444-444444444444'
    const record = markerRecord(id)

    fetchContent.mockResolvedValue(new Response(new Uint8Array([0, 0, 0, 0])))
    await store(record)
    await resumeMarkedDownloads()

    expect(await waitForDownloadsDone(5000)).toBe(true)
    assertCompletedTogether(id)
  })
})

describe('preview failure', () => {
  it('saves completed, a null preview and previewPending false', async () => {
    const id = '55555555-5555-4555-8555-555555555555'
    const record = markerRecord(id)

    fetchContent.mockResolvedValue(new Response(new Uint8Array([0, 0, 0, 0])))
    preview.isFailing = true
    await store(record)
    await queueDownload(record, JOB)

    expect(await waitForDownloadsDone(5000)).toBe(true)

    const completed = required(completedSaves(id)[0], 'completed save')

    expect(completed.output?.preview).toBeNull()
    expect(completed.previewPending).toBe(false)
  })
})
