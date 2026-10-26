import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { ModelPreset } from '@/core/presets/types'
import { WAN_30 } from '@/core/presets/wan/wan-3.0'
import type { UploadItem } from '@/core/schemas/upload-item'
import type { encodeImages as EncodeImages } from '@/server/media/image-data-url'
import type { removeUpload as RemoveUpload } from '@/server/services/uploads'

import { required } from './helpers/required'

const ROOT = path.join(process.cwd(), '.cache', `image-data-url-test-${process.pid}`)
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

const MB = 1024 * 1024
const BUDGET = 64 * MB

const ALPHA_PRESET: ModelPreset = {
  ...WAN_30,
  referenceLimits: {
    ...WAN_30.referenceLimits,
    image: { ...WAN_30.referenceLimits?.image, alpha: true },
  },
}

let encodeImages: typeof EncodeImages
let removeUpload: typeof RemoveUpload
let uploadsDir: string

beforeAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  ;({ encodeImages } = await import('@/server/media/image-data-url'))

  ;({ removeUpload } = await import('@/server/services/uploads'))

  ;({ UPLOADS_DIR: uploadsDir } = await import('@/server/paths'))
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (isNil(PREVIOUS_ROOT)) {
    delete process.env.STORAGE_ROOT
  } else {
    process.env.STORAGE_ROOT = PREVIOUS_ROOT
  }
})

async function fixture(data: Buffer, ext: '.jpg' | '.png'): Promise<UploadItem> {
  const id = randomUUID()

  await fs.mkdir(uploadsDir, { recursive: true })
  await fs.writeFile(path.join(uploadsDir, `${id}${ext}`), data)

  return {
    id,
    source: 'file',
    kind: 'image',
    mime: ext === '.png' ? 'image/png' : 'image/jpeg',
    ext,
    originalName: `fixture${ext}`,
    sizeBytes: data.length,
    createdAt: new Date().toISOString(),
  }
}

async function jpeg(width: number, height: number, color = '#4a90d9'): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: color } })
    .jpeg()
    .toBuffer()
}

async function transparent(edge: { r: number; g: number; b: number }): Promise<Buffer> {
  const square = await sharp({
    create: { width: 80, height: 80, channels: 4, background: { ...edge, alpha: 1 } },
  })
    .png()
    .toBuffer()

  return sharp({
    create: { width: 200, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: square, left: 60, top: 60 }])
    .png()
    .toBuffer()
}

function pixels(image: {
  url: string
}): Promise<{ data: Buffer; width: number; channels: number }> {
  const buffer = Buffer.from(image.url.split(',')[1] ?? '', 'base64')

  return sharp(buffer)
    .raw()
    .toBuffer({ resolveWithObject: true })
    .then(({ data, info }) => {
      return { data, width: info.width, channels: info.channels }
    })
}

describe('encodeImages sizing', () => {
  it('caps a 6000 px Wan image at 4096 on step 1', async () => {
    const upload = await fixture(await jpeg(6000, 4000), '.jpg')

    const { plan, media } = await encodeImages({
      uploads: [upload],
      preset: WAN_30,
      budgetBytes: BUDGET,
    })

    const image = required(media[upload.id], 'encoded image')

    expect(plan.step).toBe(1)
    expect(plan.maxSide).toBe(4096)
    expect(image.width).toBe(4096)
    expect(image.height).toBeLessThan(3000)
  })

  it('applies EXIF rotation and strips EXIF', async () => {
    const source = await sharp({
      create: { width: 400, height: 200, channels: 3, background: '#c33' },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer()

    const upload = await fixture(source, '.jpg')
    const { media } = await encodeImages({ uploads: [upload], preset: WAN_30, budgetBytes: BUDGET })

    const image = required(media[upload.id], 'encoded image')
    const output = Buffer.from(image.url.split(',')[1] ?? '', 'base64')
    const meta = await sharp(output).metadata()

    expect(meta.width).toBe(200)
    expect(meta.height).toBe(400)
    expect(meta.exif).toBeUndefined()
  })
})

describe('encodeImages formats', () => {
  it('sends an all-opaque RGBA PNG as JPEG', async () => {
    const source = await sharp({
      create: {
        width: 320,
        height: 200,
        channels: 4,
        background: { r: 10, g: 20, b: 30, alpha: 1 },
      },
    })
      .png()
      .toBuffer()

    const upload = await fixture(source, '.png')
    const { media } = await encodeImages({ uploads: [upload], preset: WAN_30, budgetBytes: BUDGET })

    const image = required(media[upload.id], 'encoded image')

    expect(image.format).toBe('jpeg')
  })

  it('flattens a white cutout on dark and a dark cutout on white', async () => {
    const light = await fixture(await transparent({ r: 255, g: 255, b: 255 }), '.png')
    const dark = await fixture(await transparent({ r: 34, g: 34, b: 34 }), '.png')

    const { media } = await encodeImages({
      uploads: [light, dark],
      preset: WAN_30,
      budgetBytes: BUDGET,
    })

    const lightImage = required(media[light.id], 'light image')
    const darkImage = required(media[dark.id], 'dark image')

    expect(lightImage.format).toBe('jpeg')
    expect(lightImage.flattened).toBe('#1c1e20')
    expect(darkImage.flattened).toBe('#ffffff')

    const corner = await pixels(lightImage)

    expect(corner.data[0]).toBeLessThan(80)
  })

  it('keeps PNG alpha when the preset accepts it', async () => {
    const upload = await fixture(await transparent({ r: 255, g: 255, b: 255 }), '.png')

    const { media } = await encodeImages({
      uploads: [upload],
      preset: ALPHA_PRESET,
      budgetBytes: BUDGET,
    })

    const image = required(media[upload.id], 'encoded image')

    expect(image.format).toBe('png')
    expect(image.flattened).toBeUndefined()
    const output = Buffer.from(image.url.split(',')[1] ?? '', 'base64')

    expect((await sharp(output).metadata()).hasAlpha).toBe(true)
  })

  it('converts a P3 input to the sRGB profile', async () => {
    const source = await sharp({
      create: { width: 300, height: 200, channels: 3, background: '#f80' },
    })
      .withIccProfile('p3')
      .jpeg()
      .toBuffer()

    const upload = await fixture(source, '.jpg')
    const { media } = await encodeImages({ uploads: [upload], preset: WAN_30, budgetBytes: BUDGET })

    const image = required(media[upload.id], 'encoded image')
    const output = Buffer.from(image.url.split(',')[1] ?? '', 'base64')

    const reference = await sharp({
      create: { width: 300, height: 200, channels: 3, background: '#f80' },
    })
      .withIccProfile('srgb')
      .jpeg()
      .toBuffer()

    expect(
      (await sharp(output).metadata()).icc?.equals(
        (await sharp(reference).metadata()).icc ?? Buffer.alloc(0),
      ),
    ).toBe(true)
  })
})

describe('encodeImages limits', () => {
  it('moves 30 images to the same step when the budget shrinks', async () => {
    const sources = await Promise.all(
      Array.from({ length: 30 }, () => {
        return sharp({
          create: {
            width: 800,
            height: 600,
            channels: 3,
            background: '#808080',
            noise: { type: 'gaussian', mean: 128, sigma: 50 },
          },
        })
          .jpeg()
          .toBuffer()
      }),
    )

    const uploads = await Promise.all(
      sources.map((source) => {
        return fixture(source, '.jpg')
      }),
    )

    const full = await encodeImages({ uploads, preset: WAN_30, budgetBytes: BUDGET })

    const tight = await encodeImages({
      uploads,
      preset: WAN_30,
      budgetBytes: Math.floor(full.plan.totalBytes * 0.9),
    })

    expect(tight.plan.step).toBeGreaterThan(1)
    expect(tight.plan.images).toHaveLength(30)
    expect(tight.plan.totalBytes).toBeLessThanOrEqual(Math.floor(full.plan.totalBytes * 0.9))

    for (const image of tight.plan.images) {
      expect(Math.max(image.width, image.height)).toBeLessThanOrEqual(tight.plan.maxSide)
    }
  }, 30_000)

  it('deletes every cached step with the upload', async () => {
    const upload = await fixture(await jpeg(400, 300), '.jpg')

    await encodeImages({ uploads: [upload], preset: WAN_30, budgetBytes: BUDGET })
    const cached = await fs.readdir(uploadsDir)

    expect(
      cached.some((name) => {
        return name.startsWith(`${upload.id}.encoded-`)
      }),
    ).toBe(true)

    await removeUpload(upload.id)
    const left = await fs.readdir(uploadsDir)

    expect(
      left.some((name) => {
        return name.startsWith(`${upload.id}.encoded-`)
      }),
    ).toBe(false)
  })
})
