import { isNil } from 'lodash-es'
import { describe, expect, it, vi } from 'vitest'

import { planImageCalls } from '../src/core/plan-image-calls'
import type { ImagePreset } from '../src/core/presets/image/types'
import { type ImagePriceInput, imageQuoteContext, quote } from '../src/core/pricing/quote'
import type { CustomEndpoint } from '../src/core/schemas/custom-endpoint'
import type { ImageGenerationInput } from '../src/core/schemas/image-record'
import { imagePreset } from './helpers/image-presets'

const ENDPOINT = vi.hoisted(() => {
  const endpoint: CustomEndpoint = {
    id: 'ep-runs',
    label: 'Local',
    badge: 'CU1',
    baseUrl: 'http://127.0.0.1:8188',
    enabled: true,
    pricing: { mode: 'perRun', usd: 2.5 },
    instanceId: null,
    lastHealth: null,
  }

  return endpoint
})

vi.mock('@/server/providers/custom/endpoint-source', () => {
  return {
    getEndpoint: async (id: string) => {
      return id === ENDPOINT.id ? ENDPOINT : null
    },
  }
})

const { priceImage } = await import('@/server/services/image-create')

function customPreset(maxN: number, isSeeded: boolean): ImagePreset {
  const base = imagePreset('seedream-5-0-flash')

  const params = base.params.filter((param) => {
    return param !== 'seed'
  })

  return {
    ...base,
    id: `custom.${ENDPOINT.id}.sdxl`,
    maxN,
    seed: isSeeded,
    params: isSeeded ? [...params, 'seed'] : params,
    bindings: [
      {
        provider: 'custom',
        modelId: 'sdxl',
        pricing: {
          formula: 'perRun',
          skuRules: [],
          fallback: { per_run: 2.5 },
        },
      },
    ],
  }
}

function input(preset: ImagePreset, count: number): ImageGenerationInput {
  return {
    presetId: preset.id,
    prompt: 'a cat',
    count,
    aspectRatio: preset.defaultAspectRatio,
    resolution: preset.defaultResolution,
    quality: preset.defaultQuality,
    background: preset.defaultBackground,
    references: [],
    seed: null,
  }
}

function priceInput(preset: ImagePreset, count: number): ImagePriceInput {
  return {
    count,
    aspectRatio: preset.defaultAspectRatio,
    resolution: preset.defaultResolution,
    quality: preset.defaultQuality,
    background: preset.defaultBackground,
    references: [],
    promptChars: 0,
  }
}

function total(preset: ImagePreset, count: number): number {
  const result = quote({
    preset,
    binding: preset.bindings[0],
    ctx: imageQuoteContext(preset, priceInput(preset, count)),
  })

  if (isNil(result)) {
    throw new Error('image preset has no price')
  }

  return result.total
}

describe('custom image runs', () => {
  it('bills one run per provider call for a seeded preset', () => {
    const preset = customPreset(4, true)

    expect(planImageCalls(2, preset)).toHaveLength(2)
    expect(total(preset, 1)).toBeCloseTo(2.5)
    expect(total(preset, 2)).toBeCloseTo(5)
  })

  it('uses one run when the count fits a single call', () => {
    const preset = customPreset(2, false)

    expect(planImageCalls(2, preset)).toHaveLength(1)
    expect(total(preset, 2)).toBeCloseTo(2.5)
  })

  it('priceImage returns the run total for the call plan', async () => {
    const preset = customPreset(4, true)
    const price = await priceImage({ preset, input: input(preset, 2) })

    expect(price.estimatedUsd).toBeCloseTo(5)
    expect(price.priceSource).toBe('fallback')
  })
})
