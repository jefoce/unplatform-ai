import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CallOutcome } from '@/server/jobs/image-calls'
import type * as ImageFilesModule from '@/server/services/image-files'

import type { ImageRecord } from '../src/core/schemas/image-record'

const ROOT = path.join(os.tmpdir(), `cf-image-adopt-${process.pid}-${Date.now()}`)
const IMAGES = path.join(ROOT, 'images')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

const control = vi.hoisted(() => {
  return { onWrite: null as null | (() => Promise<void>) }
})

vi.mock('@/server/services/image-files', async () => {
  const actual = await vi.importActual<typeof ImageFilesModule>('@/server/services/image-files')

  return {
    ...actual,
    writeImageOutput: async (params: Parameters<typeof actual.writeImageOutput>[0]) => {
      const saved = await actual.writeImageOutput(params)

      await control.onWrite?.()

      return saved
    },
  }
})

interface ImagesRepo {
  saveImage: (record: ImageRecord) => Promise<ImageRecord>
  getImage: (id: string) => Promise<ImageRecord | null>
  listImages: () => Promise<ImageRecord[]>
  deleteImageFiles: (id: string) => Promise<void>
}

interface OutputsModule {
  saveOutcome: (params: {
    record: ImageRecord
    outcome: CallOutcome
    resolved: CallOutcome[]
  }) => Promise<void>
}

let repo: ImagesRepo
let outputs: OutputsModule
let png = ''

beforeAll(async () => {
  const sharp = (await import('@/server/media/sharp')).default

  const buffer = await sharp({
    create: { width: 4, height: 4, channels: 3, background: '#3366aa' },
  })
    .png()
    .toBuffer()

  png = buffer.toString('base64')
  repo = await import('@/server/repos/images')
  outputs = await import('@/server/jobs/image-outputs')
})

beforeEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(IMAGES, { recursive: true })
  await repo.listImages()
})

afterEach(() => {
  control.onWrite = null
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
    status: 'saving',
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
    outputs: [{ id: randomUUID(), index: 0, status: 'pending' }],
    seedUsed: null,
    cost: {
      currency: 'USD',
      unit: 'image',
      estimatedUsd: 0.02,
      actualUsd: null,
      priceSource: 'mock',
      billed: null,
    },
  }
}

function outcome(): CallOutcome {
  return {
    start: 0,
    count: 1,
    items: [{ b64: png, mediaType: 'image/png' }],
    costUsd: 0.02,
    error: null,
    isUncertain: false,
  }
}

describe('image output adoption', () => {
  it('merges files into a record that failed mid-save', async () => {
    const saved = await repo.saveImage(record())

    control.onWrite = async () => {
      await repo.saveImage({ ...saved, status: 'failed', error: 'Interrupted while saving images' })
    }

    await outputs.saveOutcome({ record: saved, outcome: outcome(), resolved: [outcome()] })

    const current = await repo.getImage(saved.id)

    expect(current?.status).toBe('completed')
    expect(current?.error).toBeUndefined()
    expect(current?.cost.actualUsd).toBe(0.02)

    expect(current?.outputs[0]).toMatchObject({
      index: 0,
      status: 'saved',
      file: `${saved.id}-0.png`,
    })

    expect((await fs.stat(path.join(IMAGES, `${saved.id}-0.png`))).isFile()).toBe(true)
  })

  it('deletes the files when the record is gone', async () => {
    const saved = await repo.saveImage(record())

    control.onWrite = async () => {
      await repo.deleteImageFiles(saved.id)
    }

    await outputs.saveOutcome({ record: saved, outcome: outcome(), resolved: [outcome()] })

    await expect(fs.stat(path.join(IMAGES, `${saved.id}-0.png`))).rejects.toThrow()
  })
})
