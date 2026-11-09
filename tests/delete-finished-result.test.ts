/* eslint-disable max-lines, max-lines-per-function -- helper guards and both kind flows share one suite */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import { type ImageRecord, ImageRecordSchema } from '@/core/schemas/image-record'
import type { JobRef } from '@/server/providers/types'

import { storedRecord } from './helpers/stored-record'

const root = path.join(os.tmpdir(), `cf-delete-finished-${process.pid}-${Date.now()}`)

process.env.STORAGE_ROOT = root

const ISO = '2026-01-01T00:00:00.000Z'
const VIDEO_ID = '11111111-1111-4111-8111-111111111111'
const IMAGE_ID = '22222222-2222-4222-8222-222222222222'
const VIDEO_JOB = 'video-job-1'
const IMAGE_JOB = 'image-job-1'

const state = vi.hoisted(() => {
  return {
    endpoints: new Map<string, CustomEndpoint>(),
    generations: new Map<string, GenerationRecord>(),
    images: new Map<string, ImageRecord>(),
    failGenerationSave: false,
    failImageSave: false,
    probeFails: false,
    videoDelete: vi.fn<(job: JobRef) => Promise<void>>(),
    imageDelete: vi.fn<(job: JobRef) => Promise<void>>(),
    fetchContent: vi.fn<() => Promise<Response>>(),
  }
})

vi.mock('@/server/providers/custom/endpoint-source', () => {
  return {
    getEndpointSync: (id: string) => {
      return state.endpoints.get(id) ?? null
    },
  }
})

vi.mock('@/server/providers/registry', () => {
  return {
    getVideoProvider: () => {
      return {
        contentHosts: [],
        fetchContent: state.fetchContent,
        deleteResult: state.videoDelete,
      }
    },
    getImageProvider: () => {
      return { deleteResult: state.imageDelete }
    },
  }
})

vi.mock('@/server/repos/generations', () => {
  return {
    getGeneration: async (id: string) => {
      return state.generations.get(id) ?? null
    },
    saveGeneration: async (record: GenerationRecord) => {
      if (state.failGenerationSave) {
        throw new Error('save failed')
      }

      const saved = { ...record, updatedAt: new Date().toISOString() }

      state.generations.set(saved.id, saved)

      return saved
    },
    updateGeneration: async (
      id: string,
      patch: (record: GenerationRecord) => GenerationRecord | null,
    ) => {
      const current = state.generations.get(id)

      if (!current) {
        return null
      }

      const next = patch(current)

      if (!next) {
        return null
      }

      state.generations.set(id, next)

      return next
    },
    listGenerations: async () => {
      return [...state.generations.values()]
    },
  }
})

vi.mock('@/server/repos/images', () => {
  return {
    getImage: async (id: string) => {
      return state.images.get(id) ?? null
    },
    saveImage: async (record: ImageRecord) => {
      if (state.failImageSave) {
        throw new Error('save failed')
      }

      const saved = { ...record, updatedAt: new Date().toISOString() }

      state.images.set(saved.id, saved)

      return saved
    },
    removeImageOutputFile: async () => {},
  }
})

vi.mock('@/server/media/preview', () => {
  return {
    makePreview: async () => {},
  }
})

vi.mock('@/server/media/ffmpeg', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/server/media/ffmpeg')

  return {
    ...actual,
    probeMedia: async () => {
      if (state.probeFails) {
        throw new Error('bad video')
      }

      return { durationSec: 1, width: 640, height: 360 }
    },
  }
})

const { deleteFinishedResult } = await import('@/server/jobs/delete-finished-result')
const { finishImage } = await import('@/server/jobs/image-outputs')
const { queueDownload, waitForDownloadsDone } = await import('@/server/jobs/download-queue')
const { downloadPaths } = await import('@/server/paths')

function endpoint(id: string, isResultDelete: boolean): CustomEndpoint {
  return {
    id,
    label: id,
    badge: 'CU1',
    baseUrl: 'http://127.0.0.1:8188',
    enabled: true,
    pricing: { mode: 'model', usd: 0 },
    instanceId: id,
    lastHealth: {
      protocol: 1,
      serverVersion: '1.0.0',
      maxRunning: 1,
      lanAllowed: false,
      authRequired: false,
      maxUploadBytes: 0,
      resultDelete: isResultDelete,
      checkedAt: ISO,
    },
  }
}

function source(instanceId: string) {
  return {
    kind: 'custom' as const,
    instanceId,
    badge: 'CU1',
    presetTitle: 'Local',
    workflowName: null,
    endpointLabel: 'Local',
    local: true,
  }
}

function videoRecord(id: string): GenerationRecord {
  return storedRecord(id, {
    status: 'in_progress',
    provider: 'custom',
    source: source('ep1'),
    job: { id: VIDEO_JOB, submittedAt: ISO },
  })
}

const SAVED_OUTPUT = {
  id: '33333333-3333-4333-8333-333333333333',
  index: 0,
  status: 'saved' as const,
  file: 'image-0.png',
  mediaType: 'image/png' as const,
  width: 512,
  height: 512,
  bytes: 10,
  favorite: false,
  seed: null,
}

function imageRecord(overrides: Partial<ImageRecord> = {}): ImageRecord {
  return ImageRecordSchema.parse({
    id: IMAGE_ID,
    createdAt: ISO,
    updatedAt: ISO,
    status: 'saving',
    provider: 'custom',
    source: source('ep1'),
    preset: { id: 'custom.ep1.sdxl', title: 'SDXL', slug: 'sdxl' },
    input: {
      presetId: 'custom.ep1.sdxl',
      prompt: 'a cat',
      count: 1,
      aspectRatio: '1:1',
      resolution: '1K',
      quality: null,
      background: null,
      references: [],
      seed: null,
    },
    job: { id: IMAGE_JOB, submittedAt: ISO },
    outputs: [SAVED_OUTPUT],
    seedUsed: null,
    cost: {
      currency: 'USD',
      unit: 'token',
      estimatedUsd: 0,
      actualUsd: 0,
      priceSource: 'fallback',
      billed: false,
    },
    ...overrides,
  })
}

beforeAll(async () => {
  await fs.mkdir(path.join(root, 'downloads'), { recursive: true })
})

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

beforeEach(async () => {
  await fs.rm(path.join(root, 'downloads'), { recursive: true, force: true })
  await fs.mkdir(path.join(root, 'downloads'), { recursive: true })
  state.endpoints.clear()
  state.generations.clear()
  state.images.clear()
  state.failGenerationSave = false
  state.failImageSave = false
  state.probeFails = false
  state.videoDelete.mockReset()
  state.imageDelete.mockReset()
  state.fetchContent.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('delete finished result guards', () => {
  it('deletes a saved custom video result', async () => {
    state.endpoints.set('ep1', endpoint('ep1', true))

    deleteFinishedResult({
      record: {
        provider: 'custom',
        source: { instanceId: 'ep1' },
        job: { id: VIDEO_JOB, submittedAt: ISO },
      },
      kind: 'video',
    })

    await vi.waitFor(() => {
      expect(state.videoDelete).toHaveBeenCalledWith({ jobId: VIDEO_JOB, submittedAt: ISO })
    })
  })

  it('deletes a saved custom image result', async () => {
    state.endpoints.set('ep1', endpoint('ep1', true))

    deleteFinishedResult({
      record: {
        provider: 'custom',
        source: { instanceId: 'ep1' },
        job: { id: IMAGE_JOB, submittedAt: ISO },
      },
      kind: 'image',
    })

    await vi.waitFor(() => {
      expect(state.imageDelete).toHaveBeenCalledWith({ jobId: IMAGE_JOB, submittedAt: ISO })
    })
  })

  it('skips when the endpoint does not report deletes', () => {
    state.endpoints.set('ep1', endpoint('ep1', false))
    state.endpoints.set('ep2', { ...endpoint('ep2', true), lastHealth: null })

    for (const instanceId of ['ep1', 'ep2']) {
      deleteFinishedResult({
        record: {
          provider: 'custom',
          source: { instanceId },
          job: { id: VIDEO_JOB, submittedAt: ISO },
        },
        kind: 'video',
      })
    }

    expect(state.videoDelete).not.toHaveBeenCalled()
  })

  it('skips a non-custom record, a missing job, a missing source and a removed endpoint', () => {
    state.endpoints.set('ep1', endpoint('ep1', true))

    deleteFinishedResult({
      record: { provider: 'openrouter', source: { instanceId: 'ep1' } },
      kind: 'video',
    })

    deleteFinishedResult({
      record: { provider: 'custom', source: { instanceId: 'ep1' } },
      kind: 'video',
    })

    deleteFinishedResult({
      record: { provider: 'custom', job: { id: VIDEO_JOB, submittedAt: ISO } },
      kind: 'video',
    })

    deleteFinishedResult({
      record: {
        provider: 'custom',
        source: { instanceId: 'gone' },
        job: { id: VIDEO_JOB, submittedAt: ISO },
      },
      kind: 'video',
    })

    expect(state.videoDelete).not.toHaveBeenCalled()
  })

  it('logs once and resolves when the delete rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    state.endpoints.set('ep1', endpoint('ep1', true))
    state.videoDelete.mockRejectedValue(new Error('delete failed'))

    deleteFinishedResult({
      record: {
        provider: 'custom',
        source: { instanceId: 'ep1' },
        job: { id: VIDEO_JOB, submittedAt: ISO },
      },
      kind: 'video',
    })

    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledTimes(1)
    })

    expect(warn.mock.calls[0]?.[0]).toBe('[unplatform-ai] finished result cleanup failed')
  })
})

describe('video cleanup after a completed download', () => {
  it('deletes once after the record is saved completed', async () => {
    const record = videoRecord(VIDEO_ID)

    state.endpoints.set('ep1', endpoint('ep1', true))
    state.generations.set(VIDEO_ID, record)

    await fs.writeFile(downloadPaths(VIDEO_ID).video, Buffer.from('mp4'))

    await queueDownload(record, {
      status: 'completed',
      generationId: null,
      expiresAt: null,
      urls: null,
      usage: null,
      error: null,
    })

    expect(await waitForDownloadsDone(5000)).toBe(true)

    await vi.waitFor(() => {
      expect(state.videoDelete).toHaveBeenCalledTimes(1)
    })

    expect(state.generations.get(VIDEO_ID)?.status).toBe('completed')
  })

  it('does not delete when the download or verify fails', async () => {
    state.endpoints.set('ep1', endpoint('ep1', true))
    state.generations.set(VIDEO_ID, videoRecord(VIDEO_ID))
    state.fetchContent.mockResolvedValue(new Response(new Uint8Array([1, 2, 3])))
    state.probeFails = true

    await queueDownload(videoRecord(VIDEO_ID), {
      status: 'completed',
      generationId: null,
      expiresAt: null,
      urls: null,
      usage: null,
      error: null,
    })

    expect(await waitForDownloadsDone(5000)).toBe(true)

    expect(state.generations.get(VIDEO_ID)?.status).toBe('failed')
    expect(state.videoDelete).not.toHaveBeenCalled()
  })

  it('does not delete when the record write fails', async () => {
    state.endpoints.set('ep1', endpoint('ep1', true))
    state.generations.set(VIDEO_ID, videoRecord(VIDEO_ID))
    state.failGenerationSave = true

    await fs.writeFile(downloadPaths(VIDEO_ID).video, Buffer.from('mp4'))

    await queueDownload(videoRecord(VIDEO_ID), {
      status: 'completed',
      generationId: null,
      expiresAt: null,
      urls: null,
      usage: null,
      error: null,
    })

    expect(await waitForDownloadsDone(5000)).toBe(true)

    expect(state.videoDelete).not.toHaveBeenCalled()
  })
})

describe('image cleanup after finishImage', () => {
  it('deletes once after the record is saved completed', async () => {
    state.endpoints.set('ep1', endpoint('ep1', true))
    state.images.set(IMAGE_ID, imageRecord())

    await finishImage({ id: IMAGE_ID, resolved: [] })

    await vi.waitFor(() => {
      expect(state.imageDelete).toHaveBeenCalledWith({ jobId: IMAGE_JOB, submittedAt: ISO })
    })

    expect(state.images.get(IMAGE_ID)?.status).toBe('completed')
  })

  it('does not delete when the outputs failed', async () => {
    state.endpoints.set('ep1', endpoint('ep1', true))

    state.images.set(
      IMAGE_ID,
      imageRecord({
        outputs: [{ id: SAVED_OUTPUT.id, index: 0, status: 'failed', error: 'bad' }],
      }),
    )

    await finishImage({ id: IMAGE_ID, resolved: [] })

    expect(state.images.get(IMAGE_ID)?.status).toBe('failed')
    expect(state.imageDelete).not.toHaveBeenCalled()
  })

  it('does not delete while cancelled', async () => {
    state.endpoints.set('ep1', endpoint('ep1', true))
    state.images.set(IMAGE_ID, imageRecord({ status: 'cancelled' }))

    await finishImage({ id: IMAGE_ID, resolved: [] })

    expect(state.imageDelete).not.toHaveBeenCalled()
  })

  it('does not delete when the record update fails', async () => {
    state.endpoints.set('ep1', endpoint('ep1', true))
    state.images.set(IMAGE_ID, imageRecord())
    state.failImageSave = true

    await expect(finishImage({ id: IMAGE_ID, resolved: [] })).rejects.toThrow('save failed')
    expect(state.imageDelete).not.toHaveBeenCalled()
  })

  it('skips a removed endpoint', async () => {
    state.images.set(IMAGE_ID, imageRecord())

    await finishImage({ id: IMAGE_ID, resolved: [] })

    expect(state.images.get(IMAGE_ID)?.status).toBe('completed')
    expect(state.imageDelete).not.toHaveBeenCalled()
  })
})
