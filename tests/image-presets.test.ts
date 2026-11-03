import { describe, expect, it } from 'vitest'

import { DEFAULT_IMAGE_PRESET_ID, findImagePreset, IMAGE_PRESETS } from '../src/core/presets/image'
import type { ImageOption, ImagePreset } from '../src/core/presets/image/types'
import type { PricingConfig } from '../src/core/pricing/types'
import { imagePreset } from './helpers/image-presets'

const isInSet = <T extends string>(
  set: readonly ImageOption<T>[] | null,
  value: T | null,
): boolean => {
  if (set === null || value === null) {
    return set === null && value === null
  }

  return set.some((option) => {
    return option.value === value
  })
}

const labelOf = <T extends string>(
  set: readonly ImageOption<T>[] | null,
  value: T,
): string | undefined => {
  return set?.find((option) => {
    return option.value === value
  })?.label
}

const tokenRule = (preset: ImagePreset): PricingConfig | null => {
  for (const binding of preset.bindings) {
    if (binding.pricing.formula === 'imageTokens') {
      return binding.pricing
    }
  }

  return null
}

describe('image presets', () => {
  it('ships the 12 models in family order', () => {
    expect(
      IMAGE_PRESETS.map((preset) => {
        return preset.id
      }),
    ).toEqual([
      'gemini-nano-banana-2.1',
      'gemini-3.1-flash-lite-image',
      'gemini-3.1-flash-image',
      'gemini-3-pro-image',
      'gemini-2.5-flash-image',
      'seedream-5-0-flash',
      'seedream-5-0-lite',
      'seedream-5-0-pro',
      'gpt-image-2.5-sunburst',
      'gpt-image-2.5-flare',
      'gpt-image-2',
      'flux-3-image-klein',
    ])
  })

  it('keeps the default and every control default inside its option set', () => {
    expect(findImagePreset(DEFAULT_IMAGE_PRESET_ID)).not.toBeNull()

    for (const preset of IMAGE_PRESETS) {
      expect(isInSet(preset.resolutions, preset.defaultResolution), preset.id).toBe(true)
      expect(isInSet(preset.qualities, preset.defaultQuality), preset.id).toBe(true)
      expect(isInSet(preset.backgrounds, preset.defaultBackground), preset.id).toBe(true)
      expect(preset.aspectRatios, preset.id).toContain(preset.defaultAspectRatio)
    }
  })

  it('keeps counts and references inside the live ranges', () => {
    for (const preset of IMAGE_PRESETS) {
      expect(preset.maxN, preset.id).toBeGreaterThanOrEqual(1)
      expect(preset.maxN, preset.id).toBeLessThanOrEqual(10)
      expect(preset.referenceMax, preset.id).toBeGreaterThanOrEqual(0)
      expect(preset.referenceMax, preset.id).toBeLessThanOrEqual(16)
      expect(preset.promptMaxChars, preset.id).toBeGreaterThan(0)
    }
  })
})

describe('image preset options and pricing', () => {
  it('has labels on every option', () => {
    for (const preset of IMAGE_PRESETS) {
      for (const set of [preset.resolutions, preset.qualities, preset.backgrounds]) {
        for (const option of set ?? []) {
          expect(option.label.length, preset.id).toBeGreaterThan(0)
        }
      }
    }
  })

  it('labels the values the UI shows differently from the API', () => {
    const openai = imagePreset('gpt-image-2.5-sunburst')

    expect(labelOf(openai.qualities, 'xhigh')).toBe('Extra High')

    const flux = imagePreset('flux-3-image-klein')

    expect(labelOf(flux.resolutions, '1.5K')).toBe('1.5K')
  })

  it('bills every token rule with a closing empty condition', () => {
    for (const preset of IMAGE_PRESETS) {
      const pricing = tokenRule(preset)

      if (pricing === null) {
        continue
      }

      const last = pricing.tokens?.output.at(-1)

      expect(last?.when, preset.id).toEqual({})
      expect(last?.tokens, preset.id).toBeGreaterThan(0)
      expect(pricing.tokens?.reference ?? 0, preset.id).toBeGreaterThanOrEqual(0)
    }
  })

  it('prices every image variant by resolution', () => {
    const flux = imagePreset('flux-3-image-klein')
    const pricing = flux.bindings[0].pricing

    expect(pricing.formula).toBe('perImage')

    expect(
      pricing.skuRules.map((rule) => {
        return rule.key
      }),
    ).toEqual([
      'output_image_768_image',
      'output_image_1k_image',
      'output_image_1.5k_image',
      'output_image_2k_image',
      'output_image_4k_image',
    ])

    const seedream = imagePreset('seedream-5-0-pro')
    const seedreamPricing = seedream.bindings[0].pricing

    expect(seedreamPricing.fallback).toMatchObject({
      output_image_base_image: 0.045,
      output_image_high_resolution_image: 0.09,
    })
  })

  it('describes no model without a resolution control', () => {
    for (const preset of IMAGE_PRESETS) {
      if (preset.resolutions === null) {
        expect(preset.defaultResolution, preset.id).toBeNull()
      }
    }
  })
})
