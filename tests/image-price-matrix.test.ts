import { isNil } from 'lodash-es'
import { describe, expect, it } from 'vitest'

import { imageEstimateKey } from '@/lib/api/swr-keys'

import { imageEstimateBody, ImageEstimateSchema } from '../src/core/api/image'
import { IMAGE_PRESETS } from '../src/core/presets/image'
import type { ImageOption, ImagePreset } from '../src/core/presets/image/types'
import { type ImagePriceInput, imageQuoteContext, quote } from '../src/core/pricing/quote'
import type { ImageGenerationInput } from '../src/core/schemas/image-record'
import { imagePreset } from './helpers/image-presets'

type PriceControl = 'resolution' | 'quality' | 'aspect' | 'count' | 'references'

interface PriceRow {
  preset: ImagePreset
  control: PriceControl
  fixed: Partial<ImagePriceInput>
  variants: readonly Partial<ImagePriceInput>[]
  affects: boolean
}

/** One representative ratio per aspect bucket the token rules know. */
const ASPECT_BUCKETS = [
  { ratio: '1:1', bucket: 'square' },
  { ratio: '16:9', bucket: 'wide' },
  { ratio: '9:16', bucket: 'tall' },
] as const

function baseInput(preset: ImagePreset): ImagePriceInput {
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

function outputRates(preset: ImagePreset): number[] {
  return Object.entries(preset.bindings[0].pricing.fallback)
    .filter(([key]) => {
      return key.startsWith('output_image_')
    })
    .map(([, value]) => {
      return value
    })
}

function resolutionAffects(preset: ImagePreset): boolean {
  const { pricing } = preset.bindings[0]

  if (pricing.formula === 'imageTokens') {
    return (
      pricing.tokens?.output.some((rule) => {
        return !isNil(rule.when.resolution)
      }) ?? false
    )
  }

  return new Set(outputRates(preset)).size > 1
}

function tokenConditionAffects(preset: ImagePreset, key: 'quality' | 'aspect'): boolean {
  const { pricing } = preset.bindings[0]

  if (pricing.formula !== 'imageTokens') {
    return false
  }

  return (
    pricing.tokens?.output.some((rule) => {
      return !isNil(rule.when[key])
    }) ?? false
  )
}

function referenceAffects(preset: ImagePreset): boolean {
  const { pricing } = preset.bindings[0]
  const unit = pricing.formula === 'imageTokens' ? 'token' : 'image'
  const rate = pricing.fallback[`input_image_base_${unit}`]

  if (isNil(rate) || rate <= 0) {
    return false
  }

  return pricing.formula === 'perImage' || (pricing.tokens?.reference ?? 0) > 0
}

function rowsFor(preset: ImagePreset): PriceRow[] {
  const rows: PriceRow[] = []

  if (!isNil(preset.resolutions)) {
    rows.push({
      preset,
      control: 'resolution',
      fixed: {},
      variants: preset.resolutions.map((option) => {
        return { resolution: option.value }
      }),
      affects: resolutionAffects(preset),
    })
  }

  if (!isNil(preset.qualities)) {
    rows.push({
      preset,
      control: 'quality',
      fixed: { aspectRatio: '1:1' },
      variants: preset.qualities.map((option) => {
        return { quality: option.value }
      }),
      affects: tokenConditionAffects(preset, 'quality'),
    })
  }

  const aspectVariants = ASPECT_BUCKETS.filter((entry) => {
    return preset.aspectRatios.includes(entry.ratio)
  }).map((entry) => {
    return { aspectRatio: entry.ratio }
  })

  if (aspectVariants.length > 1) {
    rows.push({
      preset,
      control: 'aspect',
      fixed: {},
      variants: aspectVariants,
      affects: tokenConditionAffects(preset, 'aspect'),
    })
  }

  rows.push({
    preset,
    control: 'count',
    fixed: {},
    variants: [{ count: 1 }, { count: 2 }],
    affects: true,
  })

  if (preset.referenceMax > 0) {
    rows.push({
      preset,
      control: 'references',
      fixed: {},
      variants: [{ references: [] }, { references: ['ref-1', 'ref-2'] }],
      affects: referenceAffects(preset),
    })
  }

  return rows
}

const ROWS = IMAGE_PRESETS.flatMap((preset) => {
  return rowsFor(preset)
})

function estimate(preset: ImagePreset, overrides: Partial<ImagePriceInput>): number {
  const input = { ...baseInput(preset), ...overrides }

  const result = quote({
    preset,
    binding: preset.bindings[0],
    ctx: imageQuoteContext(preset, input),
  })

  if (isNil(result)) {
    throw new Error('image preset has no matching price rule')
  }

  return result.total
}

describe('image price matrix', () => {
  it('covers every shipped preset', () => {
    const covered = new Set(
      ROWS.map((row) => {
        return row.preset.id
      }),
    )

    expect(covered.size).toBe(IMAGE_PRESETS.length)
  })

  for (const row of ROWS) {
    it(`prices ${row.preset.id} by ${row.control}`, () => {
      const estimates = row.variants.map((variant) => {
        return estimate(row.preset, { ...row.fixed, ...variant })
      })

      const first = estimates.at(0) ?? 0

      const hasDifference = estimates.some((value) => {
        return Math.abs(value - first) > 1e-9
      })

      expect(hasDifference, `${row.preset.id} ${row.control}`).toBe(row.affects)
    })
  }
})

const KEY_PRESET = imagePreset('gemini-3-pro-image')
const REF_A = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const REF_B = '3f2504e0-4f89-41d3-9a0c-0305e82c3302'

function keyInput(overrides: Partial<ImageGenerationInput> = {}): ImageGenerationInput {
  return {
    presetId: KEY_PRESET.id,
    prompt: 'a cat',
    count: 1,
    aspectRatio: KEY_PRESET.defaultAspectRatio,
    resolution: KEY_PRESET.defaultResolution,
    quality: KEY_PRESET.defaultQuality,
    background: KEY_PRESET.defaultBackground,
    references: [],
    seed: null,
    ...overrides,
  }
}

describe('image estimate key', () => {
  it('carries every estimate input field, reference count included', () => {
    const body = imageEstimateBody(keyInput({ references: [REF_A, REF_B] }))

    expect(Object.keys(body).sort()).toEqual(Object.keys(ImageEstimateSchema.shape).sort())
    expect(body.references).toHaveLength(2)
    expect(ImageEstimateSchema.safeParse(body).success).toBe(true)
  })

  it('changes when the reference count changes', () => {
    const none = imageEstimateKey(JSON.stringify(imageEstimateBody(keyInput())))

    const two = imageEstimateKey(
      JSON.stringify(imageEstimateBody(keyInput({ references: [REF_A, REF_B] }))),
    )

    expect(none).not.toEqual(two)
  })
})

/** Provider prices these resolutions at the same rate. See each preset comment. */
const FLAT_RESOLUTION_IDS = new Set([
  'gemini-3-pro-image',
  'seedream-5-0-flash',
  'seedream-5-0-lite',
])

interface MultiResolutionPreset {
  preset: ImagePreset
  resolutions: readonly ImageOption<string>[]
}

const MULTI_RESOLUTION = IMAGE_PRESETS.flatMap((preset): MultiResolutionPreset[] => {
  const resolutions = preset.resolutions

  if (isNil(resolutions) || resolutions.length < 2) {
    return []
  }

  return [{ preset, resolutions }]
})

function resolutionEstimates(entry: MultiResolutionPreset): number[] {
  return entry.resolutions.map((option) => {
    return estimate(entry.preset, { resolution: option.value })
  })
}

describe('multi-resolution prices', () => {
  for (const entry of MULTI_RESOLUTION) {
    const label = entry.preset.id

    if (FLAT_RESOLUTION_IDS.has(label)) {
      it(`keeps sourced flat prices for ${label}`, () => {
        const estimates = resolutionEstimates(entry)

        for (let index = 1; index < estimates.length; index += 1) {
          expect(estimates[index] ?? 0, label).toBeGreaterThanOrEqual(estimates[index - 1] ?? 0)
        }
      })

      continue
    }

    it(`rises across resolutions for ${label}`, () => {
      const estimates = resolutionEstimates(entry)

      for (let index = 1; index < estimates.length; index += 1) {
        expect(estimates[index] ?? 0, label).toBeGreaterThan(estimates[index - 1] ?? 0)
      }
    })
  }
})
