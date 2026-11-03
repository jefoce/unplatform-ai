import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as ImagesRepoModule from '@/server/repos/images'
import type * as ImageActionsModule from '@/server/services/image-actions'
import type * as ImageFilesModule from '@/server/services/image-files'

import type { ImageOutput, ImageRecord } from '../src/core/schemas/image-record'

const ROOT = path.join(os.tmpdir(), `cf-image-delete-safety-${process.pid}-${Date.now()}`)
const IMAGES = path.join(ROOT, 'images')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

const control = vi.hoisted(() => {
  return { failSave: false }
})

vi.mock('@/server/repos/images', async () => {
  const actual = await vi.importActual<typeof ImagesRepoModule>('@/server/repos/images')

  return {
    ...actual,
    saveImage: async (record: ImageRecord) => {
      if (control.failSave) {
        throw new Error('disk full')
      }

      return actual.saveImage(record)
    },
  }
})

interface Seeded {
  record: ImageRecord
  outputs: ImageOutput[]
}

let repo: typeof ImagesRepoModule
let files: typeof ImageFilesModule
let actions: typeof ImageActionsModule
let pngBytes = Buffer.from('')
let testIndex = 0

beforeAll(async () => {
  const sharp = (await import('@/server/media/sharp')).default

  const png = await sharp({
    create: { width: 4, height: 4, channels: 3, background: '#8844cc' },
  })
    .png()
    .toBuffer()

  pngBytes = png
  repo = await import('@/server/repos/images')
  files = await import('@/server/services/image-files')
  actions = await import('@/server/services/image-actions')
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
  control.failSave = false
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
    status: 'completed',
    provider: 'openrouter',
    preset: { id: 'gemini-3.1-flash-image', title: 'Nano Banana 2', slug: 'gemini' },
    input: {
      presetId: 'gemini-3.1-flash-image',
      prompt: 'a cat',
      count: 2,
      aspectRatio: '1:1',
      resolution: '1K',
      quality: null,
      background: null,
      references: [],
      seed: null,
    },
    outputs: [],
    seedUsed: null,
    cost: {
      currency: 'USD',
      unit: 'image',
      estimatedUsd: 0,
      actualUsd: null,
      priceSource: 'unknown',
      billed: null,
    },
  }
}

async function seeded(): Promise<Seeded> {
  const id = randomUUID()
  const saved = await repo.saveImage(record(id))
  const outputs: ImageOutput[] = []

  for (let index = 0; index < 2; index += 1) {
    outputs.push(
      await files.writeImageOutput({
        recordId: id,
        outputId: randomUUID(),
        index,
        bytes: Uint8Array.from(pngBytes),
        mediaType: 'image/png',
      }),
    )
  }

  return { record: await repo.saveImage({ ...saved, outputs }), outputs }
}

async function isFile(file: string | null): Promise<boolean> {
  return fs.stat(file ?? '').then(
    () => {
      return true
    },
    () => {
      return false
    },
  )
}

describe('deleteOutput file order', () => {
  it('leaves the file intact when saving the filtered record fails', async () => {
    const { record: saved, outputs } = await seeded()
    const target = outputs[0]

    if (isNil(target)) {
      throw new Error('missing output fixture')
    }

    const file = repo.imageOutputFile(target)

    control.failSave = true

    await expect(actions.deleteOutput({ recordId: saved.id, outputId: target.id })).rejects.toThrow(
      'disk full',
    )

    expect(await isFile(file)).toBe(true)

    const stored = await repo.getImage(saved.id)

    expect(stored?.outputs).toHaveLength(2)
  })
})
