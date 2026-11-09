import { isNil } from 'lodash-es'
import { describe, expect, it } from 'vitest'

import { imageResolutionChoices, imageResolutionDisplay } from '../src/core/presets/common/display'
import { mapCustomModel } from '../src/core/presets/custom/from-capabilities'
import { GEMINI_31_FLASH_IMAGE } from '../src/core/presets/image/gemini/gemini-3.1-flash-image'
import type { ImagePreset } from '../src/core/presets/image/types'
import { UpaiModelListSchema } from '../src/core/protocol/upai'
import { CustomEndpointSchema } from '../src/core/schemas/custom-endpoint'
import qwenFixture from './fixtures/custom/qwen-image-models.json'

const ENDPOINT = CustomEndpointSchema.parse({
  id: 'endpoint-1',
  label: 'Studio PC',
  badge: 'CU1',
  baseUrl: 'http://127.0.0.1:8188',
})

const [MODEL] = UpaiModelListSchema.parse(qwenFixture).data

function qwenPreset(): ImagePreset {
  if (isNil(MODEL)) {
    throw new Error('Missing fixture model')
  }

  const { preset } = mapCustomModel({ endpoint: ENDPOINT, model: MODEL })

  if (isNil(preset) || 'duration' in preset) {
    throw new Error('Expected an image preset')
  }

  return preset
}

const PRESET = qwenPreset()

describe('image resolution labels', () => {
  it('uses the raw endpoint value as the title and the short side as the detail', () => {
    expect(imageResolutionDisplay(PRESET, { resolution: '2K', aspect: '4:3' })).toEqual({
      label: '2K',
      detail: '1792px',
    })

    expect(imageResolutionDisplay(PRESET, { resolution: '1K', aspect: '4:3' })).toEqual({
      label: '1K',
      detail: '896px',
    })

    expect(imageResolutionDisplay(PRESET, { resolution: '1.5K', aspect: '4:3' })).toEqual({
      label: '1.5K',
      detail: '1536px',
    })
  })

  it('reads the short side for the current aspect', () => {
    expect(imageResolutionDisplay(PRESET, { resolution: '2K', aspect: '16:9' }).detail).toBe(
      '1512px',
    )
  })

  it('keeps the static preset pixel detail', () => {
    expect(
      imageResolutionDisplay(GEMINI_31_FLASH_IMAGE, { resolution: '2K', aspect: '1:1' }),
    ).toEqual({ label: '2K', detail: '2048px' })
  })

  it('sorts custom choices by pixel area with the same labels and details', () => {
    const choices = imageResolutionChoices(PRESET, '4:3')

    expect(choices).toEqual([
      { value: '1K', label: '1K', detail: '896px' },
      { value: '1.5K', label: '1.5K', detail: '1536px' },
      { value: '2K', label: '2K', detail: '1792px' },
    ])
  })
})
