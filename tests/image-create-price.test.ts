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

const ROOT = path.join(os.tmpdir(), `cf-image-create-price-${process.pid}-${Date.now()}`)
const IMAGES = path.join(ROOT, 'images')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

vi.mock('@/server/jobs/image-submit-queue', () => {
  return { startImageSubmit: async () => {} }
})

let createImage: typeof CreateImage
let priceImage: typeof PriceImage

beforeAll(async () => {
  ;({ createImage, priceImage } = await import('@/server/services/image-create'))
})

beforeEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(IMAGES, { recursive: true })

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

function input(): ImageGenerationInput {
  return {
    presetId: 'seedream-5-0-flash',
    prompt: 'a cat',
    count: 1,
    aspectRatio: '1:1',
    resolution: '1K',
    quality: null,
    background: null,
    references: [],
    seed: null,
  }
}

describe('image create price', () => {
  it('stores the preset fallback price when no live table is available', async () => {
    const preset = imagePreset('seedream-5-0-flash')
    const imageInput = input()

    const record: ImageRecord = await createImage({
      preset,
      input: imageInput,
      price: await priceImage({ preset, input: imageInput }),
    })

    expect(record.cost.priceSource).toBe('fallback')
    expect(record.cost.estimatedUsd).toBeGreaterThan(0)
  })
})
