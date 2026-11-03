import { describe, expect, it } from 'vitest'

import { getPreset } from '../src/core/presets'
import { primaryBinding } from '../src/core/presets/common/bindings'
import type { Resolution, VideoPreset } from '../src/core/presets/video/types'
import { formatRate } from '../src/core/pricing/format'
import { type PriceContext, pricePerSec, quoteWithFallback } from '../src/core/pricing/quote'
import type { PricingConfig } from '../src/core/pricing/types'

const wan = getPreset('wan-3.0')
const prime = getPreset('wan-3.0-prime')
const seedance = getPreset('seedance-2.0')
const seedance25 = getPreset('seedance-2.5')

const ctx = (resolution: Resolution, overrides: Partial<PriceContext> = {}): PriceContext => {
  return {
    resolution,
    aspect: '16:9',
    audio: true,
    hasVideoInput: false,
    ...overrides,
  }
}

const withPricing = (pricing: PricingConfig, overrides: Partial<VideoPreset> = {}): VideoPreset => {
  return {
    ...wan,
    ...overrides,
    bindings: [{ ...primaryBinding(wan), pricing }],
  }
}

describe('pricePerSec Wan', () => {
  it('reads Wan USD keys', () => {
    expect(pricePerSec({ preset: wan, ctx: ctx('480p') })).toBe(0.05)
    expect(pricePerSec({ preset: wan, ctx: ctx('720p', { audio: false }) })).toBe(0.1)
    expect(pricePerSec({ preset: wan, ctx: ctx('1080p') })).toBe(0.2)
  })

  it('reads Prime fallback values', () => {
    expect(pricePerSec({ preset: prime, ctx: ctx('480p') })).toBe(0.068)
    expect(pricePerSec({ preset: prime, ctx: ctx('720p') })).toBe(0.14)
    expect(pricePerSec({ preset: prime, ctx: ctx('1080p') })).toBe(0.28)
  })

  it('passes audio only when the preset supports it', () => {
    const pricing: PricingConfig = {
      formula: 'perSecond',
      skuRules: [
        { when: { audio: true }, key: 'with_audio' },
        { when: {}, key: 'without_audio' },
      ],
      tiers: {},
      fallback: { with_audio: 0.3, without_audio: 0.2 },
      minBillableSec: 0,
      referenceVideoFactor: 0,
    }

    const preset = withPricing(pricing)

    expect(pricePerSec({ preset, ctx: ctx('1080p') })).toBe(0.3)
    expect(pricePerSec({ preset, ctx: ctx('1080p', { audio: false }) })).toBe(0.2)
    const silent = { ...preset, audio: { supported: false, default: false } }

    expect(pricePerSec({ preset: silent, ctx: ctx('1080p') })).toBe(0.2)
  })

  it('prefers live SKUs over the fallback', () => {
    expect(
      pricePerSec({ preset: wan, ctx: ctx('1080p'), skus: { duration_seconds_1080p: 0.25 } }),
    ).toBe(0.25)
  })

  it('returns null for missing or non-finite keys', () => {
    expect(pricePerSec({ preset: wan, ctx: ctx('768p') })).toBeNull()

    const pricing: PricingConfig = {
      formula: 'perSecond',
      skuRules: [{ when: {}, key: 'x' }],
      tiers: {},
      fallback: { x: Number.NaN },
      minBillableSec: 0,
      referenceVideoFactor: 0,
    }

    expect(pricePerSec({ preset: withPricing(pricing), ctx: ctx('1080p') })).toBeNull()
  })
})

describe('pricePerSec Seedance', () => {
  it('computes Seedance 2.0 token rates per output size', () => {
    expect(pricePerSec({ preset: seedance, ctx: ctx('720p') })).toBeCloseTo(0.1512, 6)
    expect(pricePerSec({ preset: seedance, ctx: ctx('1080p') })).toBeCloseTo(0.37422, 6)
    expect(pricePerSec({ preset: seedance, ctx: ctx('4K') })).toBeCloseTo(0.7776, 6)
    expect(pricePerSec({ preset: seedance, ctx: ctx('480p') })).toBeCloseTo(0.0672525, 6)
  })

  it('uses the video-input SKU when a video reference is attached', () => {
    expect(
      pricePerSec({ preset: seedance, ctx: ctx('720p', { hasVideoInput: true }) }),
    ).toBeCloseTo(0.09288, 6)

    expect(
      pricePerSec({ preset: seedance, ctx: ctx('1080p', { hasVideoInput: true }) }),
    ).toBeCloseTo(0.22842, 6)
  })

  it('falls back to the formula size for 9:21', () => {
    expect(pricePerSec({ preset: seedance, ctx: ctx('720p', { aspect: '9:21' }) })).toBeCloseTo(
      0.19845,
      6,
    )
  })

  it('uses the default ratio for auto aspect', () => {
    expect(pricePerSec({ preset: seedance, ctx: ctx('720p', { aspect: 'auto' }) })).toBeCloseTo(
      0.1512,
      6,
    )
  })

  it('computes Seedance 2.5 token rates', () => {
    expect(pricePerSec({ preset: seedance25, ctx: ctx('720p') })).toBeCloseTo(0.23112, 6)
    expect(pricePerSec({ preset: seedance25, ctx: ctx('480p') })).toBeCloseTo(0.1028, 6)

    expect(
      pricePerSec({ preset: seedance25, ctx: ctx('720p', { hasVideoInput: true }) }),
    ).toBeCloseTo(0.13824, 6)
  })
})

function videoQuote(
  preset: VideoPreset,
  context: PriceContext,
  duration: number,
  referenceSeconds: number,
) {
  return quoteWithFallback({
    preset,
    binding: primaryBinding(preset),
    ctx: { kind: 'video', ...context, duration, referenceSeconds },
  })
}

describe('video quote with references', () => {
  it('bills output only when the reference video factor is zero', () => {
    const pricing: PricingConfig = {
      formula: 'perSecond',
      skuRules: [{ when: {}, key: 'per_sec' }],
      tiers: {},
      fallback: { per_sec: 0.2 },
      minBillableSec: 0,
      referenceVideoFactor: 0,
    }

    const preset = withPricing(pricing)
    const result = videoQuote(preset, ctx('1080p'), 5, 10)

    expect(result?.perUnit).toBe(0.2)
    expect(result?.total).toBeCloseTo(1, 6)
  })

  it('adds reference video seconds for Wan per-second billing', () => {
    const result = videoQuote(wan, ctx('1080p'), 5, 10)

    expect(result?.perUnit).toBe(0.2)
    expect(result?.total).toBeCloseTo(3, 6)
  })

  it('bills Seedance tokens over output plus reference seconds', () => {
    const result = videoQuote(seedance, ctx('720p', { hasVideoInput: true }), 5, 3)

    expect(result?.perUnit).toBeCloseTo(0.09288, 6)
    expect(result?.total).toBeCloseTo(0.74304, 6)
  })

  it('returns null when the SKU is missing', () => {
    expect(videoQuote(wan, ctx('768p'), 5, 0)).toBeNull()
  })
})

describe('formatRate', () => {
  it('uses two decimals when the third is zero', () => {
    expect(formatRate(0.05)).toBe('$0.05/s')
    expect(formatRate(1)).toBe('$1.00/s')
  })

  it('keeps three decimals when needed', () => {
    expect(formatRate(0.068)).toBe('$0.068/s')
  })
})
