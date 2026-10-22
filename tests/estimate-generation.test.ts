import { omit } from 'lodash-es'
import { describe, expect, it } from 'vitest'

import { getPreset } from '@/core/presets'
import { buildPriceInputSchema, type PriceInput } from '@/core/validation'

const preset = getPreset('wan-3.0')

const priceInput = {
  presetId: preset.id,
  tab: 'references',
  audio: true,
  duration: 5,
  aspectRatio: '16:9',
  resolution: '1080p',
  frames: { start: null, end: null },
  references: [],
} satisfies PriceInput

describe('buildPriceInputSchema', () => {
  it('accepts a price-only object', () => {
    const parsed = buildPriceInputSchema(preset).safeParse(priceInput)

    expect(parsed.success).toBe(true)
  })

  it('ignores prompt and seed', () => {
    const parsed = buildPriceInputSchema(preset).safeParse({
      ...priceInput,
      prompt: 42,
      seed: 'not-a-seed',
    })

    expect(parsed.success).toBe(true)
  })

  it('rejects a missing price field', () => {
    const parsed = buildPriceInputSchema(preset).safeParse(omit(priceInput, 'resolution'))

    expect(parsed.success).toBe(false)
  })
})
