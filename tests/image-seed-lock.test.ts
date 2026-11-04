import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  createImage as CreateImage,
  priceImage as PriceImage,
} from '@/server/services/image-create'

import type { ImageGenerationInput, ImageRecord } from '../src/core/schemas/image-record'
import { imagePreset } from './helpers/image-presets'

const ROOT = path.join(os.tmpdir(), `cf-image-seed-lock-${process.pid}-${Date.now()}`)
const IMAGES = path.join(ROOT, 'images')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

vi.mock('@/server/jobs/image-submit-queue', () => {
  return { startImageSubmit: async () => {} }
})

let createImage: typeof CreateImage
let priceImage: typeof PriceImage
let testIndex = 0

beforeAll(async () => {
  ;({ createImage, priceImage } = await import('@/server/services/image-create'))
})

beforeEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(IMAGES, { recursive: true })

  testIndex += 1
  const stamp = new Date(Date.now() + testIndex * 1000)

  await fs.utimes(IMAGES, stamp, stamp)

  const { listImages } = await import('@/server/repos/images')

  await listImages()
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT

    return
  }

  process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

function input(seed: number | null): ImageGenerationInput {
  return {
    presetId: 'seedream-5-0-flash',
    prompt: 'a cat',
    count: 1,
    aspectRatio: '1:1',
    resolution: '1K',
    quality: null,
    background: null,
    references: [],
    seed,
  }
}

function assertSeed(record: ImageRecord, seed: number | null): void {
  expect(record.input.seed).toBe(seed)
  expect(record.seedLocked).toBe(seed !== null)
}

describe('image seed lock', () => {
  it('keeps a requested seed and marks it locked', async () => {
    const preset = imagePreset('seedream-5-0-flash')
    const imageInput = input(123)

    const record = await createImage({
      preset,
      input: imageInput,
      price: await priceImage({ preset, input: imageInput }),
    })

    assertSeed(record, 123)
    expect(record.seedUsed).toBe(123)
  })

  it('draws a new seed and leaves it unlocked', async () => {
    const preset = imagePreset('seedream-5-0-flash')
    const imageInput = input(null)

    const record = await createImage({
      preset,
      input: imageInput,
      price: await priceImage({ preset, input: imageInput }),
    })

    assertSeed(record, null)
    expect(record.seedUsed).not.toBeNull()
  })
})
