import { describe, expect, it } from 'vitest'

import { PRESET_IDS } from '../eslint-rules/selectors.mjs'
import { VIDEO_PRESETS } from '../src/core/presets'
import { IMAGE_PRESETS } from '../src/core/presets/image'

const presets = [...VIDEO_PRESETS, ...IMAGE_PRESETS]

describe('preset id lint', () => {
  it('matches every video and image preset id', () => {
    for (const preset of presets) {
      expect(PRESET_IDS.test(preset.id), preset.id).toBe(true)
    }
  })
})
