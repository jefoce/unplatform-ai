import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as JsonFileModule from '@/server/fs/json-file'
import type * as ImagesRepoModule from '@/server/repos/images'

import type { ImageOutput, ImageRecord } from '../src/core/schemas/image-record'

const ROOT = path.join(os.tmpdir(), `cf-image-delete-order-${process.pid}-${Date.now()}`)
const IMAGES = path.join(ROOT, 'images')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

const control = vi.hoisted(() => {
  return { failSuffix: '' }
})

vi.mock('@/server/fs/json-file', async () => {
  const actual = await vi.importActual<typeof JsonFileModule>('@/server/fs/json-file')

  return {
    ...actual,
    removeOwnedFile: async (file: string) => {
      if (control.failSuffix !== '' && file.endsWith(control.failSuffix)) {
        throw new Error('unlink failed')
      }

      return actual.removeOwnedFile(file)
    },
  }
})

let repo: typeof ImagesRepoModule
let testIndex = 0

beforeAll(async () => {
  repo = await import('@/server/repos/images')
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
  control.failSuffix = ''
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
    status: 'completed',
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

interface Seeded {
  id: string
  json: string
  file: string
}

async function seeded(): Promise<Seeded> {
  const id = randomUUID()
  const file = path.join(IMAGES, `${id}-0.png`)

  await fs.writeFile(file, 'bytes')

  const output: ImageOutput = {
    id: randomUUID(),
    index: 0,
    status: 'saved',
    file: `${id}-0.png`,
    mediaType: 'image/png',
    width: 1,
    height: 1,
    bytes: 5,
    favorite: false,
    seed: null,
  }

  await repo.saveImage(record(id, [output]))

  return { id, json: path.join(IMAGES, `${id}.json`), file }
}

async function exists(file: string): Promise<boolean> {
  return fs.stat(file).then(
    () => {
      return true
    },
    () => {
      return false
    },
  )
}

describe('image delete order', () => {
  it('removes the record before a file unlink fails', async () => {
    const { id, json, file } = await seeded()

    control.failSuffix = '.png'

    await expect(repo.deleteImageFiles(id)).rejects.toThrow('unlink failed')

    expect(await repo.getImage(id)).toBeNull()
    expect(await repo.listImages()).toEqual([])
    expect(await exists(json)).toBe(false)
    expect(await exists(file)).toBe(true)
  })

  it('keeps the files when the record cannot be removed', async () => {
    const { id, json, file } = await seeded()

    control.failSuffix = '.json'

    await expect(repo.deleteImageFiles(id)).rejects.toThrow('unlink failed')

    expect(await repo.getImage(id)).not.toBeNull()
    expect(await exists(json)).toBe(true)
    expect(await exists(file)).toBe(true)
  })
})
