import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CallOutcome } from '@/server/jobs/image-calls'
import type { ImageGenerateParams } from '@/server/providers/types'

import { MAX_UPLOAD_BYTES } from '../src/core/constants'
import { IMAGE_PRESETS } from '../src/core/presets/image'
import type { ImagePreset } from '../src/core/presets/image/types'
import type { ImageGenerationInput, ImageRecord } from '../src/core/schemas/image-record'
import { required } from './helpers/required'

const ROOT = path.join(os.tmpdir(), `cf-image-charged-${process.pid}-${Date.now()}`)
const IMAGES = path.join(ROOT, 'images')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

vi.mock('@/server/secrets', () => {
  return {
    getSecret: () => {
      return 'test-key'
    },
    secretsReady: async () => {},
  }
})

vi.mock('@/server/providers/registry', async () => {
  const { createOpenRouterImageProvider } = await import('@/server/providers/openrouter/images')

  return {
    getImageProvider: () => {
      return createOpenRouterImageProvider()
    },
  }
})

const { createOpenRouterImageProvider } = await import('@/server/providers/openrouter/images')
const { submitCall } = await import('@/server/jobs/image-calls')
const { finishImage, saveOutcome } = await import('@/server/jobs/image-outputs')
const { getImage, saveImage } = await import('@/server/repos/images')
const { imageCostInfo } = await import('@/features/history/details/details-info')
const { imageItems } = await import('../src/lib/feed/output-items')

const PRESET: ImagePreset = { ...IMAGE_PRESETS[0], maxN: 4 }

function input(overrides: Partial<ImageGenerationInput> = {}): ImageGenerationInput {
  return {
    presetId: PRESET.id,
    prompt: 'a cat',
    count: 1,
    aspectRatio: 'auto',
    resolution: null,
    quality: null,
    background: null,
    references: [],
    seed: null,
    ...overrides,
  }
}

function params(): ImageGenerateParams {
  return { preset: PRESET, input: input(), references: [] }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function record(): ImageRecord {
  const now = '2026-01-01T00:00:00.000Z'

  return {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: 'saving',
    provider: 'openrouter',
    preset: { id: PRESET.id, title: PRESET.title, slug: PRESET.id },
    input: input(),
    outputs: [{ id: randomUUID(), index: 0, status: 'pending' }],
    seedUsed: null,
    cost: {
      currency: 'USD',
      unit: 'image',
      estimatedUsd: 1,
      actualUsd: null,
      priceSource: 'mock',
      billed: null,
    },
  }
}

interface FailedRun {
  outcome: CallOutcome
  stored: ImageRecord
}

/** Runs one image submit against a 200 whose body fails the schema. */
async function runFailedImage(): Promise<FailedRun> {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async () => {
      return jsonResponse({})
    }),
  )

  const saved = await saveImage(record())

  const outcome = await submitCall({
    prepared: { record: saved, preset: PRESET, references: [] },
    call: { start: 0, count: 1 },
  })

  await saveOutcome({ record: saved, outcome, resolved: [outcome] })
  await finishImage({ id: saved.id, resolved: [outcome] })

  return { outcome, stored: required(await getImage(saved.id), 'stored image') }
}

beforeAll(async () => {
  await fs.mkdir(IMAGES, { recursive: true })
})

beforeEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(IMAGES, { recursive: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT

    return
  }

  process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

describe('charged image responses', () => {
  it('rejects a 200 body that fails the response schema', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => {
        return jsonResponse({})
      }),
    )

    await expect(createOpenRouterImageProvider().generate(params())).rejects.toMatchObject({
      name: 'ProviderError',
      kind: 'charged_unknown',
      status: 200,
    })
  })

  it('accepts a valid 200 body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => {
        return jsonResponse({
          data: [{ b64_json: 'x', media_type: 'image/png' }],
          usage: {},
        })
      }),
    )

    const result = await createOpenRouterImageProvider().generate(params())

    expect(result).toEqual({ items: [{ b64: 'x', mediaType: 'image/png' }], costUsd: null })
  })

  it('rejects an oversized declared body without reading it', async () => {
    let didRead = false

    const response = new Response(null, {
      status: 200,
      headers: { 'content-length': String(MAX_UPLOAD_BYTES * 4) },
    })

    Object.defineProperty(response, 'body', {
      get() {
        didRead = true

        throw new Error('body read')
      },
    })

    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => {
        return response
      }),
    )

    await expect(createOpenRouterImageProvider().generate(params())).rejects.toMatchObject({
      kind: 'charged_unknown',
      status: 200,
    })

    expect(didRead).toBe(false)
  })

  it('marks a 200 with an unusable body as possibly charged', async () => {
    const { outcome, stored } = await runFailedImage()

    expect(outcome).toMatchObject({ isUncertain: true, errorStatus: 200 })
    expect(stored.cost.mayHaveBeenCharged).toBe(true)
  })

  it('renders the charge warning for the failed record', async () => {
    const { stored } = await runFailedImage()
    const [item] = imageItems(stored)

    expect(imageCostInfo(required(item, 'image item')).note).toContain('May have been charged')
  })
})
