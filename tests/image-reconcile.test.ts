import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { ImageOutput, ImageRecord } from '../src/core/schemas/image-record'

const ROOT = path.join(os.tmpdir(), `cf-image-reconcile-${process.pid}-${Date.now()}`)
const IMAGES = path.join(ROOT, 'images')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

interface ImagesRepo {
  saveImage: (record: ImageRecord) => Promise<ImageRecord>
  getImage: (id: string) => Promise<ImageRecord | null>
  listImages: () => Promise<ImageRecord[]>
}

interface ImageFiles {
  writeImageOutput: (params: {
    recordId: string
    outputId: string
    index: number
    bytes: Uint8Array
    mediaType: 'image/png'
  }) => Promise<ImageOutput>
}

interface ReconcileModule {
  flagUnfinishedImageCharges: () => Promise<void>
  reconcileImages: () => Promise<void>
}

let repo: ImagesRepo
let files: ImageFiles
let reconcile: ReconcileModule
let pngBytes = Buffer.from('')
let testIndex = 0

beforeAll(async () => {
  const sharp = (await import('@/server/media/sharp')).default

  const png = await sharp({
    create: { width: 6, height: 4, channels: 3, background: '#3366ff' },
  })
    .png()
    .toBuffer()

  pngBytes = png
  repo = await import('@/server/repos/images')
  files = await import('@/server/services/image-files')
  reconcile = await import('@/server/jobs/image-reconcile')
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

function record(id: string, outputs: ImageOutput[]): ImageRecord {
  return {
    id,
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
    outputs,
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

async function writeOutput(recordId: string, index: number): Promise<void> {
  await files.writeImageOutput({
    recordId,
    outputId: randomUUID(),
    index,
    bytes: Uint8Array.from(pngBytes),
    mediaType: 'image/png',
  })
}

describe('reconcile image saves', () => {
  it('flags an unfinished saving record as possibly charged', async () => {
    const id = randomUUID()

    await repo.saveImage(record(id, []))

    await reconcile.flagUnfinishedImageCharges()

    const stored = await repo.getImage(id)

    expect(stored?.status).toBe('saving')
    expect(stored?.cost.mayHaveBeenCharged).toBe(true)
  })

  it('recovers two written files and fails the two missing ones with their planned ids', async () => {
    const id = randomUUID()

    const planned: ImageOutput[] = Array.from({ length: 4 }, (_, index) => {
      return { id: randomUUID(), index, status: 'pending' as const }
    })

    await writeOutput(id, 0)
    await writeOutput(id, 2)
    await repo.saveImage(record(id, planned))

    await reconcile.reconcileImages()

    const stored = await repo.getImage(id)

    expect(stored?.status).toBe('partial')
    expect(stored?.error).toBe('Interrupted while saving images')
    expect(stored?.cost.mayHaveBeenCharged).toBe(true)

    expect(
      stored?.outputs.map((output) => {
        return output.id
      }),
    ).toEqual(
      planned.map((output) => {
        return output.id
      }),
    )

    expect(stored?.outputs[0]).toMatchObject({
      status: 'saved',
      index: 0,
      file: `${id}-0.png`,
      mediaType: 'image/png',
      width: 6,
      height: 4,
      bytes: pngBytes.length,
      favorite: false,
    })

    expect(stored?.outputs[1]).toMatchObject({
      status: 'failed',
      index: 1,
      error: 'Interrupted while saving images',
    })

    expect(stored?.outputs[2]).toMatchObject({ status: 'saved', index: 2 })
    expect(stored?.outputs[3]).toMatchObject({ status: 'failed', index: 3 })
  })
})
