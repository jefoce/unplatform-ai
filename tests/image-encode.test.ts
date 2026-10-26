import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { WAN_30 } from '@/core/presets/wan/wan-3.0'
import type { UploadItem } from '@/core/schemas/upload-item'
import type { encodeImages as EncodeImages } from '@/server/media/image-data-url'

const gauge = vi.hoisted(() => {
  return {
    active: 0,
    peak: 0,
    encodes: new Map<string, number>(),
    stats: new Map<string, number>(),
  }
})

async function measured<T>(run: () => Promise<T>, map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1)
  gauge.active += 1
  gauge.peak = Math.max(gauge.peak, gauge.active)

  try {
    // Real encodes are fast, this keeps overlap observable.
    await new Promise((resolve) => {
      setTimeout(resolve, 15)
    })

    return await run()
  } finally {
    gauge.active -= 1
  }
}

vi.mock('sharp', async (importOriginal) => {
  const actual = await importOriginal<{ default: typeof sharp }>()
  const real = actual.default

  type AnySharp = ReturnType<typeof real>

  const isSharp = (value: unknown): value is AnySharp => {
    return !isNil(value) && typeof (value as { toBuffer?: unknown }).toBuffer === 'function'
  }

  const wrap = (instance: AnySharp, source: string, width?: number): AnySharp => {
    return new Proxy(instance, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver)

        if (typeof value !== 'function') {
          return value
        }

        if (prop === 'toBuffer') {
          return (...args: unknown[]) => {
            return measured(
              () => {
                return (value as (...rest: unknown[]) => Promise<Buffer>).apply(target, args)
              },
              gauge.encodes,
              `${source}:${width ?? 0}`,
            )
          }
        }

        if (prop === 'stats') {
          return (...args: unknown[]) => {
            return measured(
              () => {
                return (value as (...rest: unknown[]) => Promise<unknown>).apply(
                  target,
                  args,
                ) as Promise<never>
              },
              gauge.stats,
              source,
            )
          }
        }

        return (...args: unknown[]) => {
          const result = (value as (...rest: unknown[]) => unknown).apply(target, args)

          if (prop === 'resize') {
            const options = args[0] as { width?: number } | number | undefined
            const next = typeof options === 'object' ? options?.width : options

            return wrap(result as AnySharp, source, next)
          }

          return isSharp(result) ? wrap(result, source, width) : result
        }
      },
    })
  }

  const wrapped = ((...args: Parameters<typeof real>) => {
    return wrap((real as (...rest: unknown[]) => AnySharp)(...args), String(args[0]))
  }) as unknown as typeof real

  Object.assign(wrapped, real)

  return { ...actual, default: wrapped }
})

const ROOT = path.join(process.cwd(), '.cache', `image-encode-test-${process.pid}`)
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

const MB = 1024 * 1024
const BUDGET = 64 * MB

let encodeImages: typeof EncodeImages
let uploadsDir: string

beforeAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  ;({ encodeImages } = await import('@/server/media/image-data-url'))

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

async function fixture(data: Buffer): Promise<UploadItem> {
  const id = randomUUID()

  await fs.mkdir(uploadsDir, { recursive: true })
  await fs.writeFile(path.join(uploadsDir, `${id}.png`), data)

  return {
    id,
    source: 'file',
    kind: 'image',
    mime: 'image/png',
    ext: '.png',
    originalName: 'fixture.png',
    sizeBytes: data.length,
    createdAt: new Date().toISOString(),
  }
}

async function image(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 74, g: 144, b: 217, alpha: 1 } },
  })
    .png()
    .toBuffer()
}

describe('image encode bounds', () => {
  it('runs one encode per image and step, at most two at a time', async () => {
    const uploads = await Promise.all(
      Array.from({ length: 10 }, async () => {
        return fixture(await image(400, 300))
      }),
    )

    gauge.active = 0
    gauge.peak = 0
    gauge.encodes.clear()
    gauge.stats.clear()

    const [first, second] = await Promise.all([
      encodeImages({ uploads, preset: WAN_30, budgetBytes: BUDGET }),
      encodeImages({ uploads, preset: WAN_30, budgetBytes: BUDGET }),
    ])

    expect(first.plan).toEqual(second.plan)
    expect(gauge.peak).toBe(2)
    expect(gauge.encodes.size).toBe(10)

    for (const upload of uploads) {
      const encodes = [...gauge.encodes].filter(([key]) => {
        return key.includes(upload.id)
      })

      expect(encodes).toHaveLength(1)
      expect(encodes[0]?.[1]).toBe(1)

      const stats = [...gauge.stats].filter(([key]) => {
        return key.includes(upload.id)
      })

      expect(stats).toHaveLength(1)
    }
  })
})
