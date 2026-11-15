import sharp from 'sharp'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

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
  }, 30_000)

  it('keeps quality 86 and no scale step on a flat image', async () => {
    const capped = await encodeWebpUnderCap({ input: flat, width: SOURCE_WIDTH })

    expect(capped.quality).toBe(86)
    expect(capped.scaleSteps).toBe(0)
  }, 30_000)

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
    expect(encodes.mock.calls.length).toBeLessThanOrEqual(24)
  }, 30_000)
})

interface FakeEncodeCall {
  width: number
  height: number
  channels: number
  quality: number
  effort: number
  round: number
}

interface FakeRawOptions {
  raw: { width: number; height: number; channels: number }
}

interface FakeInputOptions {
  limitInputPixels: number
}

type FakeOptions = FakeRawOptions | FakeInputOptions

interface FakeEncodeChain {
  webp(options: { quality: number; effort: number }): { toBuffer(): Promise<Buffer> }
}

interface FakeRasterChain {
  rotate(): FakeRasterChain
  resize(options: { width: number }): FakeRasterChain
  raw(): {
    toBuffer(): Promise<{ data: Buffer; info: { width: number; height: number; channels: number } }>
  }
}

interface FakeSharp {
  (input: string | Buffer, options?: FakeOptions): FakeRasterChain | FakeEncodeChain
}

interface FakeSharpParams {
  sizeFor: (call: FakeEncodeCall) => number
}

interface FakeSharpResult {
  fake: FakeSharp
  encodes: FakeEncodeCall[]
  getDecodes: () => number
}

/** Counts decodes and encodes so a test can see the round budget. */
function createFakeSharp(params: FakeSharpParams): FakeSharpResult {
  const { sizeFor } = params
  const encodes: FakeEncodeCall[] = []
  let decodes = 0

  const fake: FakeSharp = (_input, options) => {
    if (options !== undefined && 'raw' in options) {
      const { raw } = options

      const encodeChain: FakeEncodeChain = {
        webp(webpOptions) {
          return {
            async toBuffer() {
              const call: FakeEncodeCall = {
                width: raw.width,
                height: raw.height,
                channels: raw.channels,
                quality: webpOptions.quality,
                effort: webpOptions.effort,
                round: decodes,
              }

              encodes.push(call)

              return Buffer.alloc(sizeFor(call))
            },
          }
        },
      }

      return encodeChain
    }

    let width = 0

    const rasterChain: FakeRasterChain = {
      rotate() {
        return rasterChain
      },
      resize(resizeOptions) {
        width = resizeOptions.width

        return rasterChain
      },
      raw() {
        decodes += 1

        return {
          async toBuffer() {
            return {
              data: Buffer.from([0, 0, 0, 0]),
              info: { width, height: Math.round(width / 2), channels: 3 },
            }
          },
        }
      },
    }

    return rasterChain
  }

  return {
    fake,
    encodes,
    getDecodes: () => {
      return decodes
    },
  }
}

async function loadCapped(fake: FakeSharp) {
  vi.doMock('../src/server/media/sharp', () => {
    return { default: fake, SHARP_INPUT_OPTIONS: { limitInputPixels: 1 } }
  })

  vi.resetModules()

  return import('../src/server/media/webp-cap')
}

describe('encodeWebpUnderCap with a fake sharp', () => {
  afterEach(() => {
    vi.doUnmock('../src/server/media/sharp')
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('decodes once per width and keeps the first round to six encodes', async () => {
    const fake = createFakeSharp({
      sizeFor: (call) => {
        return THUMB_MAX_BYTES + 10 - call.round
      },
    })

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const cappedModule = await loadCapped(fake.fake)

    const capped = await cappedModule.encodeWebpUnderCap({ input: 'frame.png', width: 1600 })

    const firstRound = fake.encodes.filter((call) => {
      return call.round === 1
    })

    expect(capped.scaleSteps).toBe(3)
    expect(fake.getDecodes()).toBe(capped.scaleSteps + 1)
    expect(firstRound.length).toBeLessThanOrEqual(6)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('keeps quality 86 on a flat image and finishes with effort 6', async () => {
    const fake = createFakeSharp({
      sizeFor: () => {
        return 1000
      },
    })

    const cappedModule = await loadCapped(fake.fake)

    const capped = await cappedModule.encodeWebpUnderCap({ input: 'flat.png', width: 800 })

    const final = fake.encodes.find((call) => {
      return call.effort === 6
    })

    expect(capped.quality).toBe(86)
    expect(capped.scaleSteps).toBe(0)
    expect(fake.encodes).toHaveLength(2)
    expect(final?.quality).toBe(86)
  })

  it('falls back to the effort 4 buffer when effort 6 goes over the cap', async () => {
    const fake = createFakeSharp({
      sizeFor: (call) => {
        return call.effort === 6 ? THUMB_MAX_BYTES + 1 : 1000
      },
    })

    const cappedModule = await loadCapped(fake.fake)

    const capped = await cappedModule.encodeWebpUnderCap({ input: 'flat.png', width: 800 })

    expect(capped.quality).toBe(86)
    expect(capped.scaleSteps).toBe(0)
    expect(capped.buffer.length).toBe(1000)
  })
})
