import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenerationEstimate } from '@/core/api/video'
import { getPreset } from '@/core/presets'
import type { VideoPreset } from '@/core/presets/video/types'
import type { GenerationInput } from '@/core/schemas/generation-record'
import type * as EstimateModule from '@/server/services/estimate-generation'

const ROOT = path.join(os.tmpdir(), `cf-estimate-unknown-${process.pid}-${Date.now()}`)

process.env.STORAGE_ROOT = ROOT

const mocks = vi.hoisted(() => {
  const unknown: GenerationEstimate = {
    estimatedUsd: null,
    listUsd: null,
    pricePerSec: null,
    priceSource: 'unknown',
    discount: 0,
    referenceSeconds: 0,
  }

  return { isUnknown: false, unknown }
})

vi.mock('@/server/services/estimate-generation', async (importOriginal) => {
  const actual = await importOriginal<typeof EstimateModule>()

  return {
    ...actual,
    estimateGeneration: async (draft: EstimateModule.GenerationDraft) => {
      if (mocks.isUnknown) {
        return mocks.unknown
      }

      return actual.estimateGeneration(draft)
    },
  }
})

vi.mock('@/server/services/model-catalog', async () => {
  const { findPreset } = await import('@/core/presets')

  return {
    findVideoPresetAny: async (presetId: string) => {
      return findPreset(presetId)
    },
    getModelCatalog: async () => {
      return { entries: [], fetchedAt: '2026-01-01T00:00:00.000Z' }
    },
  }
})

vi.mock('@/server/secrets', () => {
  return { secretsReady: async () => {} }
})

vi.mock('@/server/session', () => {
  return {
    hasSession: () => {
      return true
    },
  }
})

vi.mock('@/server/storage/registry', () => {
  return {
    getObjectStore: () => {
      return null
    },
  }
})

const { estimateGeneration } = await import('@/server/services/estimate-generation')

beforeAll(async () => {
  await fs.mkdir(path.join(ROOT, 'downloads'), { recursive: true })
})

beforeEach(() => {
  mocks.isUnknown = false
  vi.stubEnv('OPENROUTER_MOCK', '1')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
})

function inputFor(preset: VideoPreset): GenerationInput {
  return {
    presetId: preset.id,
    tab: 'references',
    prompt: 'a cat',
    audio: true,
    duration: 5,
    aspectRatio: '16:9',
    resolution: '1080p',
    frames: { start: null, end: null },
    references: [],
    seed: null,
  }
}

/** Wan with no fallback rate, so the quote finds no SKU for any input. */
function unpriceablePreset(): VideoPreset {
  const base = getPreset('wan-3.0')

  return {
    ...base,
    bindings: [
      {
        ...base.bindings[0],
        pricing: { ...base.bindings[0].pricing, fallback: {} },
      },
    ],
  }
}

describe('unpriceable video estimate', () => {
  it('returns null price fields and an unknown source', async () => {
    const preset = unpriceablePreset()
    const estimate = await estimateGeneration({ preset, input: inputFor(preset), uploads: {} })

    expect(estimate).toEqual(mocks.unknown)
  })

  it('refuses a submit with 409 and writes no record', async () => {
    mocks.isUnknown = true

    const { createGeneration } = await import('@/server/services/create-generation')
    const { listGenerations } = await import('@/server/repos/generations')
    const before = await listGenerations()

    await expect(createGeneration(inputFor(getPreset('wan-3.0')))).rejects.toMatchObject({
      status: 409,
      message: 'Price unavailable for this model',
    })

    expect(await listGenerations()).toHaveLength(before.length)
  })

  it('returns the null price unchanged from the estimate route', async () => {
    mocks.isUnknown = true

    const { POST } = await import('@/app/api/generations/estimate/route')

    const request = new Request('http://127.0.0.1:3000/api/generations/estimate', {
      method: 'POST',
      headers: { host: '127.0.0.1:3000', 'content-type': 'application/json' },
      body: JSON.stringify(inputFor(getPreset('wan-3.0'))),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(mocks.unknown)
  })
})
