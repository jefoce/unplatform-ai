import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ImageRecord } from '../src/core/schemas/image-record'

const ROOT = path.join(os.tmpdir(), `cf-image-stuck-saving-${process.pid}-${Date.now()}`)
const IMAGES = path.join(ROOT, 'images')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

const control = vi.hoisted(() => {
  const png =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

  return {
    generate: vi.fn(async () => {
      return { items: [{ b64: png, mediaType: 'image/png' }], costUsd: 0.01 }
    }),
  }
})

vi.mock('@/server/secrets', () => {
  return { secretsReady: async () => {} }
})

vi.mock('@/server/providers/registry', () => {
  return {
    getImageProvider: () => {
      return {
        id: 'openrouter',
        isConfigured: () => {
          return true
        },
        generate: control.generate,
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

vi.mock('@/server/jobs/image-outputs', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()

  return {
    ...actual,
    finishImage: async () => {
      throw new Error('Record save failed')
    },
  }
})

interface ImagesModule {
  getImage: (id: string) => Promise<ImageRecord | null>
  listImages: () => Promise<ImageRecord[]>
  saveImage: (record: ImageRecord) => Promise<ImageRecord>
}

interface RunModule {
  runImageSubmit: (id: string, signal?: AbortSignal) => Promise<'done' | 'requeue'>
}

let repo: ImagesModule
let runner: RunModule
let testIndex = 0

beforeAll(async () => {
  repo = await import('@/server/repos/images')
  runner = await import('@/server/jobs/image-run')
})

beforeEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(IMAGES, { recursive: true })

  testIndex += 1
  const stamp = new Date(Date.now() + testIndex * 1000)

  await fs.utimes(IMAGES, stamp, stamp)
  await repo.listImages()
  control.generate.mockClear()
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT

    return
  }

  process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

function record(id: string): ImageRecord {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'submitting',
    provider: 'openrouter',
    preset: { id: 'gemini-3.1-flash-image', title: 'Nano Banana 2', slug: 'gemini' },
    input: {
      presetId: 'gemini-3.1-flash-image',
      prompt: 'a cat',
      count: 1,
      aspectRatio: '1:1',
      resolution: '1K',
      quality: null,
      background: null,
      references: [],
      seed: null,
    },
    submit: { stage: 'grace', notBefore: '2020-01-01T00:00:00.000Z' },
    outputs: [{ id: randomUUID(), index: 0, status: 'pending' }],
    seedUsed: null,
    cost: {
      currency: 'USD',
      unit: 'image',
      estimatedUsd: 0,
      actualUsd: null,
      priceSource: 'mock',
      billed: null,
    },
  }
}

describe('runImageSubmit after a failed save', () => {
  it('recovers the saving record from disk instead of leaving it stuck', async () => {
    const id = randomUUID()

    await repo.saveImage(record(id))
    await runner.runImageSubmit(id)

    const stored = await repo.getImage(id)

    expect(stored?.status).toBe('completed')
    expect(stored?.submit).toBeUndefined()
    expect(stored?.error).toBeUndefined()
  })
})
