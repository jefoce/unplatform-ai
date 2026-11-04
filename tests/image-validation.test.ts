import { describe, expect, it } from 'vitest'

import { SEED_MAX } from '../src/core/constants'
import { type ImageGenerationInput, ImageInputSchema } from '../src/core/schemas/image-record'
import type { ValidationIssue } from '../src/core/validation/common'
import {
  validateImageInput,
  validateImagePrompt,
  validateImageSettings,
} from '../src/core/validation/image'
import { imagePreset } from './helpers/image-presets'

const issue = (text: string): ValidationIssue => {
  return { type: 'text', text }
}

const base = (overrides: Partial<ImageGenerationInput> = {}): ImageGenerationInput => {
  return ImageInputSchema.parse({
    presetId: 'gemini-3.1-flash-image',
    prompt: 'a cat',
    count: 1,
    aspectRatio: '1:1',
    resolution: '1K',
    quality: null,
    background: null,
    references: [],
    seed: null,
    ...overrides,
  })
}

function seedInput(seed: number) {
  return {
    presetId: 'gemini-3.1-flash-image',
    prompt: 'a cat',
    count: 1,
    aspectRatio: '1:1',
    resolution: '1K',
    quality: null,
    background: null,
    references: [],
    seed,
  }
}

describe('ImageInputSchema seed bounds', () => {
  it('accepts zero and the maximum', () => {
    expect(ImageInputSchema.safeParse(seedInput(0)).success).toBe(true)
    expect(ImageInputSchema.safeParse(seedInput(SEED_MAX)).success).toBe(true)
  })

  it('rejects a negative, fractional or too-large seed', () => {
    expect(ImageInputSchema.safeParse(seedInput(-1)).success).toBe(false)
    expect(ImageInputSchema.safeParse(seedInput(1.5)).success).toBe(false)
    expect(ImageInputSchema.safeParse(seedInput(SEED_MAX + 1)).success).toBe(false)
  })
})

describe('validateImageInput split', () => {
  it('keeps an empty prompt out of the settings check', () => {
    const preset = imagePreset('gemini-3.1-flash-image')

    expect(validateImageSettings(preset, base({ prompt: '' }))).toEqual([])
    expect(validateImagePrompt(preset, '')).toEqual([issue('Prompt is required')])
  })
})

describe('validateImageInput preset gaps', () => {
  it('accepts the default input on a controller model', () => {
    const preset = imagePreset('gemini-3.1-flash-image')

    expect(validateImageInput(preset, base())).toEqual([])
  })

  it('rejects a resolution on a model without the control', () => {
    const preset = imagePreset('gemini-2.5-flash-image')

    expect(validateImageInput(preset, base())).toEqual([
      issue('This model does not take a resolution'),
    ])

    expect(validateImageInput(preset, base({ resolution: null }))).toEqual([])
  })

  it('rejects every control a model does not expose', () => {
    const gpt = imagePreset('gpt-image-2')

    const valid = base({ resolution: null, quality: 'auto', background: null })

    expect(validateImageInput(gpt, valid)).toEqual([])

    expect(validateImageInput(gpt, { ...valid, background: 'auto' })).toEqual([
      issue('This model does not take a background'),
    ])

    expect(validateImageInput(gpt, { ...valid, quality: 'xhigh' })).toEqual([
      issue('Quality is not supported by this model'),
    ])
  })

  it('rejects a seed that is not a whole number', () => {
    const seedream = imagePreset('seedream-5-0-flash')
    const valid = base({ resolution: '1K' })

    expect(validateImageInput(seedream, { ...valid, seed: 1.5 })).toEqual([issue('Invalid seed')])
    expect(validateImageInput(seedream, { ...valid, seed: 0 })).toEqual([])
  })

  it('rejects too many references for the preset', () => {
    const gemini = imagePreset('gemini-2.5-flash-image')
    const references = ['a', 'b', 'c', 'd']

    expect(validateImageInput(gemini, base({ resolution: null, references }))).toEqual([
      issue('Too many references'),
    ])
  })
})
