import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { SHARP_INPUT_OPTIONS } from '@/server/media/sharp'
import { probe } from '@/server/services/upload-probe'

import { MAX_IMAGE_PIXELS } from '../src/core/constants'

const dir = path.join(os.tmpdir(), `cf-sharp-limit-${process.pid}-${Date.now()}`)

beforeAll(async () => {
  await fs.mkdir(dir, { recursive: true })
})

afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe('sharp limits', () => {
  it('caps every decoded image at the shared pixel limit', () => {
    expect(SHARP_INPUT_OPTIONS.limitInputPixels).toBe(MAX_IMAGE_PIXELS)
  })

  it('probes a normal image inside the cap', async () => {
    const file = path.join(dir, 'small.png')

    await sharp({ create: { width: 16, height: 16, channels: 3, background: '#fff' } })
      .png()
      .toFile(file)

    await expect(probe(file, 'image')).resolves.toEqual({ width: 16, height: 16 })
  })
})
