import { describe, expect, it, vi } from 'vitest'

import { plannedCalls, seedForImage, submitCall } from '@/server/jobs/image-calls'

import { SEED_MAX } from '../src/core/constants'
import type { ImageGenerationInput, ImageRecord } from '../src/core/schemas/image-record'
import { imagePreset } from './helpers/image-presets'

const generate = vi.hoisted(() => {
  return vi.fn()
})

vi.mock('@/server/providers/registry', () => {
  return {
    getImageProvider: () => {
      return {
        id: 'openrouter',
        isConfigured: () => {
          return true
        },
        generate,
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

function input(presetId: string): ImageGenerationInput {
  return {
    presetId,
    prompt: 'a cat',
    count: 4,
    aspectRatio: '1:1',
    resolution: '1K',
    quality: null,
    background: null,
    references: [],
    seed: null,
  }
}

interface RecordParams {
  presetId: string
  seedUsed: number | null
  seed?: number | null
}

function record(params: RecordParams): ImageRecord {
  const { presetId, seedUsed, seed = null } = params

  return {
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'submitting',
    provider: 'openrouter',
    preset: { id: presetId, title: presetId, slug: presetId },
    input: { ...input(presetId), seed },
    outputs: [],
    seedUsed,
    cost: {
      currency: 'USD',
      unit: 'image',
      estimatedUsd: 0,
      actualUsd: null,
      priceSource: 'mock',
      billed: null,
    },
  }
}

function seedAt(callIndex: number): number | null {
  const params = generate.mock.calls[callIndex]?.[0] as
    { input: { seed: number | null } } | undefined

  return params?.input.seed ?? null
}

describe('image seeds', () => {
  it('sends one distinct sequential seed per Seedream image', async () => {
    const preset = imagePreset('seedream-5-0-flash')
    const source = record({ presetId: preset.id, seedUsed: 1000 })
    const prepared = { record: source, preset, references: [] }

    generate.mockResolvedValue({ items: [{ b64: '', mediaType: 'image/png' }], costUsd: null })

    const calls = plannedCalls(source, preset)

    for (const call of calls) {
      await submitCall({ prepared, call })
    }

    expect(calls).toEqual([
      { start: 0, count: 1 },
      { start: 1, count: 1 },
      { start: 2, count: 1 },
      { start: 3, count: 1 },
    ])

    const seeds = Array.from({ length: calls.length }, (_, index) => {
      return seedAt(index)
    })

    expect(seeds).toEqual([1000, 1001, 1002, 1003])
  })

  it('wraps the offset at SEED_MAX', () => {
    expect(seedForImage(SEED_MAX, 0)).toBe(SEED_MAX)
    expect(seedForImage(SEED_MAX, 1)).toBe(0)
    expect(seedForImage(null, 3)).toBeNull()
  })

  it('sends no seed for a preset without seed support', async () => {
    const preset = imagePreset('flux-3-image-klein')
    const source = record({ presetId: preset.id, seedUsed: 5, seed: 99 })
    const prepared = { record: source, preset, references: [] }

    generate.mockResolvedValue({ items: [{ b64: '', mediaType: 'image/png' }], costUsd: null })

    await submitCall({ prepared, call: { start: 0, count: 1 } })

    expect(seedAt(0)).toBeNull()
  })
})
