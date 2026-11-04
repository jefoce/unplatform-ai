import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { CallOutcome } from '@/server/jobs/image-calls'
import type { ImageResultItem } from '@/server/providers/types'

import type { ImageOutput, ImageRecord } from '../src/core/schemas/image-record'

const ROOT = path.join(os.tmpdir(), `cf-image-output-isolation-${process.pid}-${Date.now()}`)
const IMAGES = path.join(ROOT, 'images')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

interface ImagesRepo {
  saveImage: (record: ImageRecord) => Promise<ImageRecord>
  getImage: (id: string) => Promise<ImageRecord | null>
  listImages: () => Promise<ImageRecord[]>
  imageOutputFile: (output: ImageOutput) => string | null
}

interface OutputsModule {
  saveOutcome: (params: {
    record: ImageRecord
    outcome: CallOutcome
    resolved: CallOutcome[]
  }) => Promise<void>
  finishImage: (params: { id: string; resolved: CallOutcome[] }) => Promise<void>
}

let repo: ImagesRepo
let outputs: OutputsModule
let pngBytes = Buffer.from('')
let testIndex = 0

beforeAll(async () => {
  const sharp = (await import('@/server/media/sharp')).default

  const png = await sharp({
    create: { width: 4, height: 4, channels: 3, background: '#44aa66' },
  })
    .png()
    .toBuffer()

  pngBytes = png
  repo = await import('@/server/repos/images')
  outputs = await import('@/server/jobs/image-outputs')
})

beforeEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(IMAGES, { recursive: true })

  testIndex += 1
  const stamp = new Date(Date.now() + testIndex * 1000)

  await fs.utimes(IMAGES, stamp, stamp)
  await repo.listImages()
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
  return {
    id: randomUUID(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'saving',
    provider: 'openrouter',
    preset: { id: 'gemini-3.1-flash-image', title: 'Nano Banana 2', slug: 'gemini' },
    input: {
      presetId: 'gemini-3.1-flash-image',
      prompt: 'a cat',
      count: 4,
      aspectRatio: '1:1',
      resolution: '1K',
      quality: null,
      background: null,
      references: [],
      seed: null,
    },
    outputs: Array.from({ length: 4 }, (_, index) => {
      return { id: randomUUID(), index, status: 'pending' as const }
    }),
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

function item(index: number): ImageResultItem {
  if (index === 1) {
    return { b64: Buffer.from('not an image').toString('base64'), mediaType: 'image/png' }
  }

  return { b64: pngBytes.toString('base64'), mediaType: 'image/png' }
}

function outcome(): CallOutcome {
  return {
    start: 0,
    count: 4,
    items: Array.from({ length: 4 }, (_, index) => {
      return item(index)
    }),
    costUsd: 0.04,
    error: null,
    isUncertain: false,
  }
}

function mixedOutcome(): CallOutcome {
  return {
    start: 0,
    count: 4,
    items: [item(0), { error: 'Unsupported image type: image/svg+xml' }, item(2), item(3)],
    costUsd: 0.04,
    error: null,
    isUncertain: false,
  }
}

describe('image output save isolation', () => {
  it('turns an invalid provider item into a failed output and keeps the rest', async () => {
    const saved = await repo.saveImage(record())
    const mixed = mixedOutcome()

    await outputs.saveOutcome({ record: saved, outcome: mixed, resolved: [mixed] })
    await outputs.finishImage({ id: saved.id, resolved: [mixed] })

    const stored = await repo.getImage(saved.id)

    expect(stored?.status).toBe('partial')

    expect(
      stored?.outputs.map((output) => {
        return output.status
      }),
    ).toEqual(['saved', 'failed', 'saved', 'saved'])

    expect(stored?.outputs[1]).toMatchObject({
      status: 'failed',
      error: 'Unsupported image type: image/svg+xml',
    })
  })

  it('saves the other three when the second item fails to write', async () => {
    const saved = await repo.saveImage(record())

    await outputs.saveOutcome({ record: saved, outcome: outcome(), resolved: [outcome()] })
    await outputs.finishImage({ id: saved.id, resolved: [outcome()] })

    const stored = await repo.getImage(saved.id)

    expect(stored?.status).toBe('partial')

    expect(
      stored?.outputs.map((output) => {
        return output.status
      }),
    ).toEqual(['saved', 'failed', 'saved', 'saved'])

    expect(stored?.outputs[1]).toMatchObject({ index: 1, status: 'failed' })

    for (const output of stored?.outputs ?? []) {
      const file = repo.imageOutputFile(output)

      const stats = await fs.stat(file ?? '').catch(() => {
        return null
      })

      if (output.status === 'saved') {
        expect(stats?.isFile()).toBe(true)
        continue
      }

      expect(stats).toBeNull()
    }
  })
})
