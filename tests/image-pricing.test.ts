/* eslint-disable max-lines -- price cases share one fixture set */

import { isNil } from 'lodash-es'
import { describe, expect, it } from 'vitest'

import { IMAGE_PRESETS } from '../src/core/presets/image'
import type { ImagePreset } from '../src/core/presets/image/types'
import { type ImagePriceInput, imageQuoteContext, quote } from '../src/core/pricing/quote'
import type { PricingConfig } from '../src/core/pricing/types'
import { imagePreset } from './helpers/image-presets'

const BASE = imagePreset('flux-3-image-klein')

const withPricing = (pricing: PricingConfig): ImagePreset => {
  return {
    ...BASE,
    bindings: [{ ...BASE.bindings[0], pricing }],
  }
}

const input = (overrides: Partial<ImagePriceInput> = {}): ImagePriceInput => {
  return {
    count: 1,
    aspectRatio: '1:1',
    resolution: null,
    quality: null,
    background: null,
    references: [],
    promptChars: 0,
    ...overrides,
  }
}

interface EstimateParams {
  preset: ImagePreset
  input: ImagePriceInput
}

/** Quote from the preset fallback, the same path the estimate route uses. */
function estimateImage(params: EstimateParams) {
  const { preset, input: priceInput } = params

  const result = quote({
    preset,
    binding: preset.bindings[0],
    ctx: imageQuoteContext(preset, priceInput),
  })

  if (isNil(result)) {
    throw new Error('image preset has no matching price rule')
  }

  return {
    perImageUsd: result.perUnit,
    usd: result.total,
    unit: result.unit,
    isApproximate: result.isApproximate,
  }
}

const IMAGE_PRICING: PricingConfig = {
  formula: 'perImage',
  skuRules: [
    { when: { resolution: '2K' }, key: 'output_image_2k_image' },
    { when: {}, key: 'output_image_base_image' },
  ],
  fallback: {
    output_image_base_image: 0.01,
    output_image_2k_image: 0.02,
    input_image_base_image: 0.003,
  },
}

const TOKEN_PRICING: PricingConfig = {
  formula: 'imageTokens',
  skuRules: [{ when: {}, key: 'output_image_base_token' }],
  fallback: {
    output_image_base_token: 1,
    input_image_base_token: 2,
  },
  tokens: {
    output: [
      { when: { resolution: '4K' }, tokens: 10 },
      { when: { aspect: 'wide' }, tokens: 5 },
      { when: {}, tokens: 1 },
    ],
    reference: 3,
  },
}

describe('estimateImage per image', () => {
  it('picks the high resolution variant and bills references per call', () => {
    const preset = withPricing(IMAGE_PRICING)

    const result = estimateImage({
      preset,
      input: input({ count: 3, resolution: '2K', references: ['a', 'b'] }),
    })

    expect(result.perImageUsd).toBeCloseTo((0.02 * 3 + 0.003 * 2 * 3) / 3)
    expect(result.usd).toBeCloseTo(0.02 * 3 + 0.003 * 2 * 3)
    expect(result.unit).toBe('image')
    expect(result.isApproximate).toBe(false)
  })

  it('falls back to the unvariant line', () => {
    const preset = withPricing(IMAGE_PRICING)
    const result = estimateImage({ preset, input: input({ resolution: '1K' }) })

    expect(result.perImageUsd).toBeCloseTo(0.01)
  })
})

describe('estimateImage per token', () => {
  it('uses the first matching output rule', () => {
    const preset = withPricing(TOKEN_PRICING)
    const fourK = estimateImage({ preset, input: input({ resolution: '4K' }) })
    const wide = estimateImage({ preset, input: input({ aspectRatio: '16:9' }) })
    const square = estimateImage({ preset, input: input() })

    expect(fourK.perImageUsd).toBeCloseTo(10)
    expect(wide.perImageUsd).toBeCloseTo(5)
    expect(square.perImageUsd).toBeCloseTo(1)
    expect(fourK.isApproximate).toBe(true)
    expect(fourK.unit).toBe('token')
  })

  it('bills reference tokens once per call', () => {
    const preset = withPricing(TOKEN_PRICING)

    const result = estimateImage({
      preset,
      input: input({ resolution: '4K', count: 2, references: ['a', 'b'] }),
    })

    expect(result.perImageUsd).toBeCloseTo((10 * 2 + 3 * 2 * 2 * 2) / 2)
    expect(result.usd).toBeCloseTo(10 * 2 + 3 * 2 * 2 * 2)
  })
})

describe('estimateImage shipped presets', () => {
  it('prices FLUX by resolution', () => {
    const flux = imagePreset('flux-3-image-klein')
    const oneK = estimateImage({ preset: flux, input: input({ resolution: '1K' }) })
    const fourK = estimateImage({ preset: flux, input: input({ resolution: '4K' }) })

    expect(oneK.perImageUsd).toBeCloseTo(0.009)
    expect(fourK.perImageUsd).toBeCloseTo(0.036)
  })

  it('prices Seedream Pro by resolution and reference', () => {
    const pro = imagePreset('seedream-5-0-pro')
    const oneK = estimateImage({ preset: pro, input: input({ resolution: '1K' }) })

    const twoK = estimateImage({
      preset: pro,
      input: input({ resolution: '2K', references: ['a', 'b'] }),
    })

    expect(oneK.perImageUsd).toBeCloseTo(0.045)
    expect(twoK.perImageUsd).toBeCloseTo(0.096)
  })

  it('multiplies a per-image preset by the count', () => {
    const lite = imagePreset('seedream-5-0-lite')

    const result = estimateImage({
      preset: lite,
      input: input({ resolution: '4K', count: 4 }),
    })

    expect(result.perImageUsd).toBeCloseTo(0.035)
    expect(result.usd).toBeCloseTo(0.14)
  })

  it('estimates GPT and Gemini token costs', () => {
    const gpt = imagePreset('gpt-image-2.5-sunburst')
    const outputPerImage = 1056 * 0.00003
    const referenceCost = 1024 * 0.000008

    const gptResult = estimateImage({
      preset: gpt,
      input: input({ count: 4, references: ['a'] }),
    })

    expect(gptResult.usd).toBeCloseTo(outputPerImage * 4 + referenceCost)
    expect(gptResult.perImageUsd).toBeCloseTo((outputPerImage * 4 + referenceCost) / 4)

    const gemini = imagePreset('gemini-2.5-flash-image')

    const geminiResult = estimateImage({
      preset: gemini,
      input: input({ references: ['a', 'b', 'c'] }),
    })

    expect(geminiResult.perImageUsd).toBeCloseTo(1120 * 0.00003 + 258 * 0.0000003 * 3)
  })

  it('prices GPT Image 2 low square from the measured token count', () => {
    const gpt = imagePreset('gpt-image-2')

    const low = estimateImage({ preset: gpt, input: input({ quality: 'low' }) })
    const high = estimateImage({ preset: gpt, input: input({ quality: 'high' }) })

    expect(low.perImageUsd).toBeCloseTo(196 * 0.00003)
    expect(high.perImageUsd).toBeCloseTo(4160 * 0.00003)
  })
})

describe('estimateImage Gemini resolution tokens', () => {
  it('prices Gemini output tokens from the per-model resolution table', () => {
    const flash = imagePreset('gemini-3.1-flash-image')

    const flashOneK = estimateImage({
      preset: flash,
      input: input({ resolution: '1K' }),
    })

    const flashTwoK = estimateImage({
      preset: flash,
      input: input({ resolution: '2K' }),
    })

    const flashFourK = estimateImage({
      preset: flash,
      input: input({ resolution: '4K' }),
    })

    const flashHalfK = estimateImage({
      preset: flash,
      input: input({ resolution: '512' }),
    })

    expect(flashHalfK.perImageUsd).toBeCloseTo(747 * 0.000066)
    expect(flashOneK.perImageUsd).toBeCloseTo(1120 * 0.000066)
    expect(flashTwoK.perImageUsd).toBeCloseTo(1680 * 0.000066)
    expect(flashFourK.perImageUsd).toBeCloseTo(2520 * 0.000066)

    const nano = imagePreset('gemini-nano-banana-2.1')

    const nanoOneK = estimateImage({ preset: nano, input: input({ resolution: '1K' }) })
    const nanoTwoK = estimateImage({ preset: nano, input: input({ resolution: '2K' }) })
    const nanoFourK = estimateImage({ preset: nano, input: input({ resolution: '4K' }) })

    expect(nanoOneK.perImageUsd).toBeCloseTo(1120 * 0.00003)
    expect(nanoTwoK.perImageUsd).toBeCloseTo(1680 * 0.00003)
    expect(nanoFourK.perImageUsd).toBeCloseTo(3780 * 0.00003)

    const pro = imagePreset('gemini-3-pro-image')

    const proOneK = estimateImage({ preset: pro, input: input({ resolution: '1K' }) })
    const proTwoK = estimateImage({ preset: pro, input: input({ resolution: '2K' }) })
    const proFourK = estimateImage({ preset: pro, input: input({ resolution: '4K' }) })

    expect(proOneK.perImageUsd).toBeCloseTo(1120 * 0.00012)
    expect(proTwoK.perImageUsd).toBeCloseTo(1120 * 0.00012)
    expect(proFourK.perImageUsd).toBeCloseTo(2000 * 0.00012)
  })
})

describe('image pricing call count', () => {
  it('bills Seedream Pro references once per call', () => {
    const pro = imagePreset('seedream-5-0-pro')

    const references = Array.from({ length: 14 }, (_, index) => {
      return `ref-${String(index)}`
    })

    const result = estimateImage({
      preset: pro,
      input: input({ count: 4, resolution: '1K', references }),
    })

    // maxN is 1 on a seeded preset, so four calls resend all 14 references.
    expect(result.usd).toBeCloseTo(0.045 * 4 + 0.003 * 14 * 4)
  })
})

describe('image prompt tokens', () => {
  it('prices prompt text at four characters per token', () => {
    const gpt = imagePreset('gpt-image-2')
    const output = 1056 * 0.00003

    const short = estimateImage({
      preset: gpt,
      input: input({ promptChars: 40 }),
    })

    const long = estimateImage({
      preset: gpt,
      input: input({ promptChars: 80 }),
    })

    expect(short.usd).toBeCloseTo(output + 10 * 0.000005)
    expect(long.usd).toBeCloseTo(output + 20 * 0.000005)
  })

  it('bills prompt tokens once per call', () => {
    const gpt = imagePreset('gpt-image-2')
    const output = 1056 * 0.00003

    const result = estimateImage({
      preset: gpt,
      input: input({ count: 11, promptChars: 40 }),
    })

    // maxN is 10, so eleven images make two calls.
    expect(result.usd).toBeCloseTo(output * 11 + 10 * 0.000005 * 2)
  })
})

describe('auto aspect', () => {
  it('prices auto as the preset default bucket', () => {
    for (const preset of IMAGE_PRESETS) {
      if (!preset.aspectRatios.includes('auto')) {
        continue
      }

      const explicit =
        preset.defaultAspectRatio === 'auto' ? preset.autoAspectRatio : preset.defaultAspectRatio

      if (isNil(explicit)) {
        continue
      }

      const base = { resolution: preset.defaultResolution, quality: preset.defaultQuality }
      const auto = estimateImage({ preset, input: input({ ...base, aspectRatio: 'auto' }) })
      const named = estimateImage({ preset, input: input({ ...base, aspectRatio: explicit }) })

      expect(auto.usd, preset.id).toBeCloseTo(named.usd)
    }
  })
})
