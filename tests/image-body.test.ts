import { describe, expect, it } from 'vitest'

import { buildImageBody } from '@/server/providers/openrouter/images'

import { IMAGE_PRESETS } from '../src/core/presets/image'
import { IMAGE_PARAMS, type ImagePreset } from '../src/core/presets/image/types'
import type { ImageGenerationInput } from '../src/core/schemas/image-record'

const REFERENCES = [
  { id: 'ref-1', dataUrl: 'data:image/png;base64,AAAA' },
  { id: 'ref-2', dataUrl: 'data:image/png;base64,BBBB' },
]

function input(preset: ImagePreset): ImageGenerationInput {
  return {
    presetId: preset.id,
    prompt: 'a cat',
    count: preset.maxN,
    aspectRatio: '16:9',
    resolution: '1K',
    quality: 'high',
    background: 'opaque',
    references: [],
    seed: 42,
  }
}

function expectedKeys(preset: ImagePreset): string[] {
  return ['model', 'prompt', ...preset.params].sort()
}

describe('image request body', () => {
  it('sends exactly the fields each preset declares', () => {
    for (const preset of IMAGE_PRESETS) {
      for (const param of preset.params) {
        expect(IMAGE_PARAMS, preset.id).toContain(param)
      }

      const body = buildImageBody({ preset, input: input(preset), references: REFERENCES })

      expect(Object.keys(body).sort(), preset.id).toEqual(expectedKeys(preset))
    }
  })

  it('never sends output_format because PNG is the provider default', () => {
    for (const preset of IMAGE_PRESETS) {
      const body = buildImageBody({ preset, input: input(preset), references: REFERENCES })

      expect(body, preset.id).not.toHaveProperty('output_format')
    }
  })

  it('has no outputFormat field on any preset', () => {
    for (const preset of IMAGE_PRESETS) {
      expect(Object.keys(preset), preset.id).not.toContain('outputFormat')
      // @ts-expect-error outputFormat left the preset type
      expect(preset.outputFormat).toBeUndefined()
    }
  })

  it('never sends resolution when the preset does not declare it', () => {
    const preset = IMAGE_PRESETS.find((item) => {
      return !item.params.includes('resolution')
    })

    expect(preset).toBeDefined()

    if (!preset) {
      return
    }

    const body = buildImageBody({ preset, input: input(preset), references: REFERENCES })

    expect(body).not.toHaveProperty('resolution')
  })
})
