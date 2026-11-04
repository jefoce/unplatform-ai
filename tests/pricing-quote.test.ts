import { describe, expect, it } from 'vitest'

import { loadLivePricing, registerLivePricing } from '@/server/pricing/live'

import { VIDEO_PRESETS } from '../src/core/presets'
import { primaryBinding } from '../src/core/presets/common/bindings'
import { IMAGE_PRESETS } from '../src/core/presets/image'
import {
  type ImagePriceInput,
  imageQuoteContext,
  quote,
  quoteWithFallback,
  type VideoQuoteContext,
} from '../src/core/pricing/quote'

function videoContext(): VideoQuoteContext {
  return {
    kind: 'video',
    resolution: '720p',
    aspect: '16:9',
    audio: true,
    hasVideoInput: false,
    duration: 5,
    referenceSeconds: 0,
  }
}

function imageInput(presetId: string): ImagePriceInput {
  const preset = IMAGE_PRESETS.find((candidate) => {
    return candidate.id === presetId
  })

  if (!preset) {
    throw new Error(`unknown image preset ${presetId}`)
  }

  return {
    count: 1,
    aspectRatio: preset.defaultAspectRatio,
    resolution: preset.defaultResolution,
    quality: preset.defaultQuality,
    background: preset.defaultBackground,
    references: [],
    promptChars: 0,
  }
}

describe('quote matrix', () => {
  it('quotes every video preset from its fallback table', () => {
    for (const preset of VIDEO_PRESETS) {
      const result = quote({
        preset,
        binding: primaryBinding(preset),
        ctx: videoContext(),
      })

      expect(result, preset.id).not.toBeNull()
      expect(result?.source, preset.id).toBe('fallback')
      expect(result?.unit, preset.id).toBe('second')
      expect(result?.total ?? 0, preset.id).toBeGreaterThanOrEqual(0)
    }
  })

  it('quotes every image preset from its fallback table', () => {
    for (const preset of IMAGE_PRESETS) {
      const result = quote({
        preset,
        binding: preset.bindings[0],
        ctx: imageQuoteContext(preset, imageInput(preset.id)),
      })

      expect(result, preset.id).not.toBeNull()
      expect(result?.source, preset.id).toBe('fallback')
      expect(result?.total ?? 0, preset.id).toBeGreaterThan(0)
    }
  })

  it('marks live SKUs as live', () => {
    const preset = VIDEO_PRESETS[0]

    const result = quote({
      preset,
      binding: primaryBinding(preset),
      ctx: videoContext(),
      skus: { duration_seconds_720p: 0.5 },
    })

    expect(result?.source).toBe('live')
    expect(result?.perUnit).toBe(0.5)
  })
})

describe('provider adapter', () => {
  it('needs only an adapter and a preset pricing table', async () => {
    registerLivePricing({
      provider: 'openrouter',
      kind: 'video',
      loader: async () => {
        return {
          skus: { duration_seconds_720p: 0.75 },
          listSkus: { duration_seconds_720p: 1 },
          discountPct: 0.25,
          source: 'live',
        }
      },
    })

    const live = await loadLivePricing({
      provider: 'openrouter',
      kind: 'video',
      modelId: 'stub/model',
      fallback: { duration_seconds_720p: 0.1 },
    })

    const preset = VIDEO_PRESETS[0]
    const binding = { ...primaryBinding(preset), pricing: { ...primaryBinding(preset).pricing } }

    const result = quote({
      preset,
      binding,
      ctx: videoContext(),
      skus: live.skus,
    })

    expect(live.discountPct).toBe(0.25)
    expect(result?.source).toBe('live')
    expect(result?.perUnit).toBe(0.75)
  })
})

describe('fallback quote', () => {
  it('re-quotes an image preset when the live table has no rate', () => {
    const preset = IMAGE_PRESETS[0]

    const result = quoteWithFallback({
      preset,
      binding: preset.bindings[0],
      ctx: imageQuoteContext(preset, imageInput(preset.id)),
      skus: {},
    })

    expect(result?.source).toBe('fallback')
    expect(result?.total ?? 0).toBeGreaterThan(0)
  })

  it('re-quotes a video preset when the live table has no rate', () => {
    const preset = VIDEO_PRESETS[0]

    const result = quoteWithFallback({
      preset,
      binding: primaryBinding(preset),
      ctx: videoContext(),
      skus: {},
    })

    expect(result?.source).toBe('fallback')
    expect(result?.total ?? 0).toBeGreaterThan(0)
  })

  it('keeps a live quote that has the rate', () => {
    const preset = VIDEO_PRESETS[0]

    const result = quoteWithFallback({
      preset,
      binding: primaryBinding(preset),
      ctx: videoContext(),
      skus: { duration_seconds_720p: 0.5 },
    })

    expect(result?.source).toBe('live')
    expect(result?.total).toBeCloseTo(2.5)
  })
})
