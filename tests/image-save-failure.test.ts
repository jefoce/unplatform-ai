import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ImageResultItem } from '@/server/providers/types'
import type * as ImagesRepoModule from '@/server/repos/images'

import type { ImageRecord } from '../src/core/schemas/image-record'

const ROOT = path.join(os.tmpdir(), `cf-image-save-failure-${process.pid}-${Date.now()}`)
const IMAGES = path.join(ROOT, 'images')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

const control = vi.hoisted(() => {
  return { failSaving: false }
})

vi.mock('@/server/repos/images', async () => {
  const actual = await vi.importActual<typeof ImagesRepoModule>('@/server/repos/images')

  return {
    ...actual,
    saveImage: async (record: ImageRecord) => {
      const hasSaved = record.outputs.some((output) => {
        return output.status === 'saved'
      })

      if (control.failSaving && record.status !== 'failed' && hasSaved) {
        throw new Error('ENOSPC: no space left on device')
      }

      return actual.saveImage(record)
    },
  }
})

vi.mock('@/server/secrets', () => {
  return { secretsReady: async () => {} }
})

const item = vi.hoisted(() => {
  return { value: null as ImageResultItem | null }
})

vi.mock('@/server/providers/registry', () => {
  return {
    getImageProvider: () => {
      return {
        id: 'openrouter',
        isConfigured: () => {
          return true
        },
        generate: async () => {
          return { items: [item.value], costUsd: 0.01 }
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

interface ImagesRepo {
  listImages: () => Promise<ImageRecord[]>
  saveImage: (record: ImageRecord) => Promise<ImageRecord>
  getImage: (id: string) => Promise<ImageRecord | null>
  deleteImageFiles: (id: string) => Promise<void>
}

interface RunModule {
  runImageSubmit: (id: string) => Promise<'done' | 'requeue'>
}

interface RunModule {
  runImageSubmit: (id: string) => Promise<'done' | 'requeue'>
}

let repo: ImagesRepo
let runner: RunModule
let testIndex = 0

beforeAll(async () => {
  const sharp = (await import('@/server/media/sharp')).default

  const png = await sharp({
    create: { width: 4, height: 4, channels: 3, background: '#44aa66' },
  })
    .png()
    .toBuffer()

  item.value = { b64: png.toString('base64'), mediaType: 'image/png' }
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
})

afterEach(() => {
  control.failSaving = false
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT

    return
  }

  process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

function record(): ImageRecord {
  const now = new Date().toISOString()

  return {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
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

describe('image save failure', () => {
  it('fails a saving record when every save attempt fails', async () => {
    const saved = await repo.saveImage(record())
    const outputId = saved.outputs[0]?.id ?? ''

    control.failSaving = true
    await runner.runImageSubmit(saved.id)

    const failed = await repo.getImage(saved.id)
    const first = failed?.outputs[0]

    expect(failed?.status).toBe('failed')
    expect(failed?.error).toBeDefined()
    expect(failed?.cost.mayHaveBeenCharged).toBe(true)

    expect(first).toMatchObject({
      id: outputId,
      index: 0,
      status: 'saved',
      file: `${saved.id}-0.png`,
    })

    const file = path.join(IMAGES, `${saved.id}-0.png`)

    expect((await fs.stat(file)).isFile()).toBe(true)

    await repo.deleteImageFiles(saved.id)

    expect(await repo.getImage(saved.id)).toBeNull()
  })
})
