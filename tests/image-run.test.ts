/* eslint-disable max-lines -- shared submit fixtures stay in one suite */

import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import sharp from '@/server/media/sharp'
import type { ImageResultItem } from '@/server/providers/types'

import type { ImageGenerationInput, ImageRecord } from '../src/core/schemas/image-record'

const ROOT = path.join(os.tmpdir(), `cf-image-run-${process.pid}-${Date.now()}`)
const IMAGES = path.join(ROOT, 'images')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

const control = vi.hoisted(() => {
  return {
    generate: vi.fn<(params: unknown) => Promise<unknown>>(),
  }
})

vi.mock('@/server/secrets', () => {
  return { secretsReady: async () => {} }
})

vi.mock('@/server/providers/registry', () => {
  return {
    getImageProvider: () => {
      return {
        id: 'openrouter',
        isConfigured: () => {
          return true
        },
        generate: control.generate,
        listModels: async () => {
          return { models: [], isFresh: true }
        },
        testConnection: async () => {
          return { ok: true }
        },
      }
    },
  }
})

interface ImagesModule {
  listImages: () => Promise<ImageRecord[]>
  saveImage: (record: ImageRecord) => Promise<ImageRecord>
  getImage: (id: string) => Promise<ImageRecord | null>
}

interface RunModule {
  runImageSubmit: (id: string, signal?: AbortSignal) => Promise<'done' | 'requeue'>
}

let repo: ImagesModule
let runner: RunModule
let item: ImageResultItem
let recordId = ''
let testIndex = 0

beforeAll(async () => {
  const png = await sharp({
    create: { width: 4, height: 4, channels: 3, background: '#00ff88' },
  })
    .png()
    .toBuffer()

  item = { b64: png.toString('base64'), mediaType: 'image/png' }
  repo = await import('@/server/repos/images')
  runner = await import('@/server/jobs/image-run')
})

beforeEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(IMAGES, { recursive: true })

  testIndex += 1
  const stamp = new Date(Date.now() + testIndex * 1000)

  await fs.utimes(IMAGES, stamp, stamp)
  await repo.listImages()

  control.generate.mockReset()

  control.generate.mockImplementation(async (params: unknown) => {
    const input = (params as { input: { count: number } }).input

    return {
      items: Array.from({ length: input.count }, () => {
        return item
      }),
      costUsd: 0.01,
    }
  })

  recordId = randomUUID()
  await repo.saveImage(makeRecord(recordId))
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT

    return
  }

  process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

const defaultInput: ImageGenerationInput = {
  presetId: 'gemini-3.1-flash-image',
  prompt: 'a cat',
  count: 4,
  aspectRatio: '1:1',
  resolution: '1K',
  quality: null,
  background: null,
  references: [],
  seed: null,
}

function makeRecord(id: string, overrides: Partial<ImageRecord> = {}): ImageRecord {
  const now = new Date().toISOString()
  const input = overrides.input ?? defaultInput

  const outputs = Array.from({ length: input.count }, (_, index) => {
    return { id: randomUUID(), index, status: 'pending' as const }
  })

  return {
    id,
    createdAt: now,
    updatedAt: now,
    status: 'submitting',
    provider: 'openrouter',
    preset: { id: 'gemini-3.1-flash-image', title: 'Nano Banana 2', slug: 'gemini' },
    input,
    submit: { stage: 'grace', notBefore: '2020-01-01T00:00:00.000Z' },
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
    ...overrides,
  }
}

function indexPath(output: { file?: string }): string {
  return path.join(IMAGES, path.basename(output.file ?? ''))
}

const idsOf = (record: ImageRecord | null | undefined): string[] | undefined => {
  return record?.outputs.map((output) => {
    return output.id
  })
}

describe('runImageSubmit', () => {
  it('saves every planned call with its planned id and marks the record completed', async () => {
    const planned = await repo.getImage(recordId)

    await runner.runImageSubmit(recordId)

    const record = await repo.getImage(recordId)

    expect(control.generate).toHaveBeenCalledTimes(4)
    expect(record?.status).toBe('completed')
    expect(record?.submit).toBeUndefined()

    expect(
      record?.outputs.map((output) => {
        return output.index
      }),
    ).toEqual([0, 1, 2, 3])

    expect(idsOf(record)).toEqual(idsOf(planned))

    expect(
      record?.outputs.every((output) => {
        return output.status === 'saved'
      }),
    ).toBe(true)

    expect(record?.cost.actualUsd).toBeCloseTo(0.04)

    for (const output of record?.outputs ?? []) {
      if (output.status !== 'saved') {
        continue
      }

      const stats = await fs.stat(indexPath(output))

      expect(stats.isFile()).toBe(true)
      expect(output).toMatchObject({ width: 4, height: 4 })
    }
  })
})

describe('runImageSubmit planned ids', () => {
  it('keeps partial results when one call fails', async () => {
    let calls = 0

    control.generate.mockImplementation(async (params: unknown) => {
      calls += 1

      if (calls === 2) {
        throw new Error('Provider rejected the image')
      }

      const input = (params as { input: { count: number } }).input

      return { items: [{ ...item }], costUsd: 0.01, count: input.count }
    })

    const planned = await repo.getImage(recordId)

    await runner.runImageSubmit(recordId)

    const record = await repo.getImage(recordId)

    expect(record?.status).toBe('partial')
    expect(record?.outputs).toHaveLength(4)

    expect(idsOf(record)).toEqual(idsOf(planned))

    expect(
      record?.outputs.filter((output) => {
        return output.status === 'saved'
      }),
    ).toHaveLength(3)

    expect(record?.outputs[1]).toMatchObject({
      status: 'failed',
      error: 'Provider rejected the image',
    })

    // Only the three successful calls contribute cost.
    expect(record?.cost.actualUsd).toBeCloseTo(0.03)
  })

  it('leaves actual cost unknown when a success reports no cost', async () => {
    control.generate.mockResolvedValue({ items: [item, item, item, item], costUsd: null })

    await runner.runImageSubmit(recordId)

    const record = await repo.getImage(recordId)

    expect(record?.cost.actualUsd).toBeNull()
  })

  it('marks the record failed when every call fails', async () => {
    control.generate.mockRejectedValue(new Error('Provider rejected the image'))

    await runner.runImageSubmit(recordId)

    const record = await repo.getImage(recordId)

    expect(record?.status).toBe('failed')
    expect(record?.error).toBe('Provider rejected the image')
    expect(record?.outputs).toHaveLength(4)

    expect(
      record?.outputs.every((output) => {
        return output.status === 'failed'
      }),
    ).toBe(true)
  })

  it('fails the record when a reference is gone before submit', async () => {
    const id = randomUUID()

    await repo.saveImage({
      ...makeRecord(id),
      input: { ...makeRecord(id).input, references: [randomUUID()] },
    })

    await runner.runImageSubmit(id)

    const record = await repo.getImage(id)

    expect(record?.status).toBe('failed')
    expect(record?.error).toBe('A reference was removed before submit')
    expect(control.generate).not.toHaveBeenCalled()
  })
})

describe('runImageSubmit persistence', () => {
  it('keeps the first two paid images while the other calls are still running', async () => {
    const hold = Promise.withResolvers<void>()
    let calls = 0

    control.generate.mockImplementation(async (params: unknown) => {
      calls += 1

      if (calls <= 2) {
        const input = (params as { input: { count: number } }).input

        return { items: [{ ...item }], costUsd: 0.01, count: input.count }
      }

      await hold.promise

      return { items: [{ ...item }], costUsd: 0.01 }
    })

    const run = runner.runImageSubmit(recordId)

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const record = await repo.getImage(recordId)

      const saved = record?.outputs.filter((output) => {
        return output.status === 'saved'
      }).length

      if (saved === 2) {
        break
      }

      await new Promise((resolve) => {
        setTimeout(resolve, 20)
      })
    }

    const midway = await repo.getImage(recordId)

    expect(midway?.status).toBe('saving')

    expect(
      midway?.outputs.filter((output) => {
        return output.status === 'saved'
      }),
    ).toHaveLength(2)

    hold.resolve()
    await run

    expect((await repo.getImage(recordId))?.status).toBe('completed')
  })
})

describe('runImageSubmit seeds', () => {
  it('records one seed per saved image and keeps the base seed', async () => {
    const id = randomUUID()

    await repo.saveImage(
      makeRecord(id, {
        preset: { id: 'seedream-5-0-flash', title: 'Seedream 5 Flash', slug: 'seedream' },
        input: {
          ...makeRecord(id).input,
          presetId: 'seedream-5-0-flash',
          seed: null,
        },
        seedUsed: 100,
      }),
    )

    await runner.runImageSubmit(id)

    const record = await repo.getImage(id)

    const seeds = record?.outputs.map((output) => {
      return output.status === 'saved' ? output.seed : null
    })

    expect(record?.seedUsed).toBe(100)
    expect(seeds).toEqual([100, 101, 102, 103])
  })

  it('sends one call per Lite image with its own seed and records it', async () => {
    const id = randomUUID()

    await repo.saveImage(
      makeRecord(id, {
        preset: { id: 'seedream-5-0-lite', title: 'Seedream 5 Lite', slug: 'seedream' },
        input: {
          ...makeRecord(id).input,
          presetId: 'seedream-5-0-lite',
          seed: null,
        },
        seedUsed: 100,
      }),
    )

    await runner.runImageSubmit(id)

    const record = await repo.getImage(id)

    const sent = control.generate.mock.calls.map((call) => {
      const params = call[0] as { input: { seed: number | null } }

      return params.input.seed
    })

    const saved = record?.outputs.map((output) => {
      return output.status === 'saved' ? output.seed : null
    })

    expect(control.generate).toHaveBeenCalledTimes(4)
    expect(sent).toEqual([100, 101, 102, 103])
    expect(saved).toEqual([100, 101, 102, 103])
  })
})
