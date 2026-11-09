import { isNil } from 'lodash-es'
import { describe, expect, it } from 'vitest'

import { resolutionHeight, resolutionRange, shortSideOf } from '../src/core/presets/common/display'
import { mapCustomModel } from '../src/core/presets/custom/from-capabilities'
import type { VideoPreset } from '../src/core/presets/video/types'
import { UpaiModelListSchema } from '../src/core/protocol/upai'
import { CustomEndpointSchema } from '../src/core/schemas/custom-endpoint'
import minimaxFixture from './fixtures/custom/minimax-h3-models.json'

const ENDPOINT = CustomEndpointSchema.parse({
  id: 'endpoint-1',
  label: 'Studio PC',
  badge: 'CU1',
  baseUrl: 'http://127.0.0.1:8188',
})

const MODELS = UpaiModelListSchema.parse(minimaxFixture).data

function minimaxPreset(): VideoPreset {
  const [model] = MODELS

  if (isNil(model)) {
    throw new Error('Missing fixture model')
  }

  const { preset } = mapCustomModel({ endpoint: ENDPOINT, model })

  if (isNil(preset) || !('duration' in preset)) {
    throw new Error('Expected a video preset')
  }

  return preset
}

const PRESET = minimaxPreset()

describe('compact custom resolution', () => {
  it('reads the shortest side of a size string', () => {
    expect(shortSideOf('1472x640')).toBe(640)
    expect(shortSideOf('1920x1088')).toBe(1088)
    expect(shortSideOf('wide')).toBeNull()
  })

  it('uses the short side for the 21:9 range and the 0.9 height', () => {
    expect(resolutionRange(PRESET, { aspect: '21:9' })).toBe('288\u2013960p')
    expect(resolutionHeight(PRESET, { resolution: '0.9', aspect: '21:9' })).toBe('640p')
  })

  it('uses the short side for the 16:9 range and the 0.9 height', () => {
    expect(resolutionRange(PRESET, { aspect: '16:9' })).toBe('352\u20131088p')
    expect(resolutionHeight(PRESET, { resolution: '0.9', aspect: '16:9' })).toBe('736p')
  })

  it('falls back to the raw first and last without sizes', () => {
    const preset = { ...PRESET, outputSizes: undefined }

    expect(resolutionRange(preset, { aspect: '16:9' })).toBe('0.2\u20132.0')
    expect(resolutionHeight(preset, { resolution: '0.9', aspect: '16:9' })).toBeNull()
  })
})
