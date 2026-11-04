import { describe, expect, it } from 'vitest'

import { imagePickerModel } from '@/features/generator/model/image-picker-model'
import { imagePickerModels } from '@/features/image-generator/image-picker-models'

import { IMAGE_PRESETS } from '../src/core/presets/image'
import { imagePreset } from './helpers/image-presets'

describe('image picker models', () => {
  it('shows a from-price for every preset', () => {
    const models = imagePickerModels()

    expect(models).toHaveLength(IMAGE_PRESETS.length)

    for (const model of models) {
      expect(model.priceText, model.id).toMatch(/^from \$\d+\.\d{2}$/)
    }
  })

  it('uses the live rate when the catalog has one', () => {
    const preset = imagePreset('seedream-5-0-flash')
    const model = imagePickerModel(preset, { output_image_base_image: 0.03 })

    expect(model.priceText).toBe('from $0.03')
  })

  it('uses the preset fallback when the live table has no rate', () => {
    const preset = imagePreset('seedream-5-0-flash')
    const model = imagePickerModel(preset, {})

    expect(model.priceText).toBe('from $0.02')
  })
})
