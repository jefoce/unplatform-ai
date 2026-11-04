import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { ImageRecord } from '@/core/schemas/image-record'
import type { JobSnapshot } from '@/server/providers/types'

import { imageLabels, imageRecord, videoLabels, videoRecord } from './helpers/status-labels'

const ROOT = path.join(os.tmpdir(), `cf-status-labels-${process.pid}-${Date.now()}`)

process.env.STORAGE_ROOT = ROOT

const mock = vi.hoisted(() => {
  const png =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

  const videoById = new Map<string, GenerationRecord>()
  const imageById = new Map<string, ImageRecord>()

  function videoSave(record: GenerationRecord): GenerationRecord {
    const saved = { ...record, updatedAt: new Date().toISOString() }

    videoById.set(saved.id, saved)

    return saved
  }

  function imageSave(record: ImageRecord): ImageRecord {
    const saved = { ...record, updatedAt: new Date().toISOString() }

    imageById.set(saved.id, saved)

    return saved
  }

  return {
    videoById,
    videoRecords: [] as GenerationRecord[],
    imageById,
    imageRecords: [] as ImageRecord[],
    jobStatuses: [] as JobSnapshot['status'][],
    png,
    videoSave,
    imageSave,
  }
})

async function saveVideo(record: GenerationRecord): Promise<GenerationRecord> {
  const saved = mock.videoSave(record)

  mock.videoRecords.push(structuredClone(saved))

  return saved
}

async function saveImageRecord(record: ImageRecord): Promise<ImageRecord> {
  const saved = mock.imageSave(record)

  mock.imageRecords.push(structuredClone(saved))

  return saved
}

vi.mock('@/server/secrets', () => {
  return { secretsReady: async () => {} }
})

vi.mock('@/server/storage/registry', () => {
  return {
    getObjectStore: () => {
      return null
    },
  }
})

vi.mock('@/server/repos/generations', () => {
  return {
    getGeneration: async (id: string) => {
      return mock.videoById.get(id) ?? null
    },
    saveGeneration: saveVideo,
    updateGeneration: async (
      id: string,
      patch: (record: GenerationRecord) => GenerationRecord | null,
    ) => {
      const current = mock.videoById.get(id)

      if (!current) {
        return null
      }

      const next = patch(current)

      if (!next) {
        return null
      }

      return saveVideo(next)
    },
    listGenerations: async () => {
      return [...mock.videoById.values()]
    },
    listActiveGenerations: async () => {
      return [...mock.videoById.values()]
    },
    getActiveCount: async () => {
      return 0
    },
    deleteGenerationFiles: async () => {},
  }
})

vi.mock('@/server/repos/images', () => {
  return {
    getImage: async (id: string) => {
      return mock.imageById.get(id) ?? null
    },
    saveImage: saveImageRecord,
    listImages: async () => {
      return [...mock.imageById.values()]
    },
    removeImageOutputFile: async () => {},
  }
})

vi.mock('@/server/providers/registry', () => {
  return {
    getVideoProvider: () => {
      return {
        id: 'openrouter',
        contentHosts: [],
        submit: async () => {
          return { jobId: 'mock-job', status: 'pending' }
        },
        getJob: async () => {
          const status = mock.jobStatuses.shift() ?? 'completed'

          return {
            status,
            generationId: null,
            expiresAt: null,
            urls: null,
            usage: null,
            error: null,
          }
        },
        fetchContent: async () => {
          return new Response(new Uint8Array([0, 0, 0, 0]))
        },
      }
    },
    getImageProvider: () => {
      return {
        id: 'openrouter',
        isConfigured: () => {
          return true
        },
        generate: async () => {
          return { items: [{ b64: mock.png, mediaType: 'image/png' }], costUsd: 0 }
        },
        listModels: async () => {
          return { models: [], isFresh: true }
        },
        testConnection: async () => {
          return { ok: true }
        },
      }
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
    makePreview: async () => {},
  }
})

const { runSubmit } = await import('@/server/jobs/run-submit')
const { processRecord } = await import('@/server/jobs/poll-record')
const { waitForDownloadsDone } = await import('@/server/jobs/download-queue')
const { runImageSubmit } = await import('@/server/jobs/image-run')
const { saveGeneration, getGeneration } = await import('@/server/repos/generations')
const { saveImage } = await import('@/server/repos/images')
const { createFileUpload } = await import('@/server/services/uploads')

beforeAll(async () => {
  await fs.mkdir(ROOT, { recursive: true })
})

beforeEach(() => {
  mock.videoById.clear()
  mock.videoRecords.length = 0
  mock.imageById.clear()
  mock.imageRecords.length = 0
  mock.jobStatuses.length = 0
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
})

describe('status labels at every stage change', () => {
  it('records the video sequence with references', async () => {
    const bytes = await fs.readFile(path.join(process.cwd(), 'tests/fixtures/media/sample.png'))

    const upload = await createFileUpload({
      bytes: new Uint8Array(bytes),
      originalName: 'reference.png',
    })

    const record = videoRecord([upload.id])

    await saveGeneration(record)
    await runSubmit(record.id)

    mock.jobStatuses.push('in_progress', 'completed')

    const submitted = await getGeneration(record.id)

    if (!submitted) {
      throw new Error('Missing submitted record')
    }

    await processRecord(submitted)
    await processRecord(submitted)
    await waitForDownloadsDone(5000)

    expect(videoLabels(mock.videoRecords)).toEqual([
      'Processing',
      'Uploading',
      'Sending',
      'Processing',
      'Generating',
      'Downloading',
      'Completed',
    ])
  })

  it('records the image sequence', async () => {
    const record = imageRecord()

    await saveImage(record)
    await runImageSubmit(record.id)

    expect(imageLabels(mock.imageRecords)).toEqual([
      'Processing',
      'Sending',
      'Generating',
      'Completed',
    ])
  })
})
