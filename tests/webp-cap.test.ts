import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { encodeWebpUnderCap, THUMB_MAX_BYTES } from '../src/server/media/webp-cap'

const SOURCE_WIDTH = 1600
const SOURCE_HEIGHT = 900

let noisy = Buffer.alloc(0)
let flat = Buffer.alloc(0)

beforeAll(async () => {
  noisy = await sharp({
    create: {
      width: SOURCE_WIDTH,
      height: SOURCE_HEIGHT,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
      noise: { type: 'gaussian', mean: 128, sigma: 8 },
    },
  })
    .png()
    .toBuffer()

  flat = await sharp({
    create: {
      width: SOURCE_WIDTH,
      height: SOURCE_HEIGHT,
      channels: 3,
      background: { r: 90, g: 120, b: 150 },
    },
  })
    .png()
    .toBuffer()
})

afterAll(() => {
  vi.restoreAllMocks()
})

describe('encodeWebpUnderCap', () => {
  it('keeps a noisy 1600x900 frame at or under the cap as WebP without alpha', async () => {
    const capped = await encodeWebpUnderCap({ input: noisy, width: SOURCE_WIDTH })
    const metadata = await sharp(capped.buffer).metadata()

    expect(capped.buffer.length).toBeLessThanOrEqual(THUMB_MAX_BYTES)
    expect(metadata.format).toBe('webp')
    expect(metadata.hasAlpha).toBe(false)
  })

  it('keeps quality 86 and no scale step on a flat image', async () => {
    const capped = await encodeWebpUnderCap({ input: flat, width: SOURCE_WIDTH })

    expect(capped.quality).toBe(86)
    expect(capped.scaleSteps).toBe(0)
  })

  it('returns a buffer, warns once and stays inside the encode budget', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const encodes = vi.spyOn(sharp.prototype, 'webp')

    const capped = await encodeWebpUnderCap({
      input: noisy,
      width: SOURCE_WIDTH,
      maxBytes: 1000,
    })

    expect(capped.buffer.length).toBeGreaterThan(0)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('thumb over cap')
    expect(encodes.mock.calls.length).toBeLessThanOrEqual(8)
  })
})
