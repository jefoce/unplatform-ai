import { isNil } from 'lodash-es'
import { describe, expect, it } from 'vitest'

import { IMAGE_PRESETS } from '../src/core/presets/image'
import { IMAGE_PARAMS, type ImageOption } from '../src/core/presets/image/types'

const valuesOf = <T extends string>(set: readonly ImageOption<T>[] | null): T[] => {
  if (isNil(set)) {
    return []
  }

  return set.map((option) => {
    return option.value
  })
}

describe('image preset controls', () => {
  describe.each(IMAGE_PRESETS)('$title', (preset) => {
    it('matches the controls to the declared params', () => {
      const hasParameter = (param: (typeof IMAGE_PARAMS)[number]): boolean => {
        return preset.params.includes(param)
      }

      expect(hasParameter('resolution')).toBe(!isNil(preset.resolutions))

      if (!isNil(preset.resolutions)) {
        expect(valuesOf(preset.resolutions)).toContain(preset.defaultResolution)
      }

      expect(hasParameter('quality')).toBe(!isNil(preset.qualities))

      if (!isNil(preset.qualities)) {
        expect(valuesOf(preset.qualities)).toContain(preset.defaultQuality)
      }

      expect(hasParameter('background')).toBe(!isNil(preset.backgrounds))

      if (!isNil(preset.backgrounds)) {
        expect(valuesOf(preset.backgrounds)).toContain(preset.defaultBackground)
      }

      expect(hasParameter('seed')).toBe(preset.seed)
      expect(hasParameter('input_references')).toBe(preset.referenceMax > 0)
      expect(hasParameter('n')).toBe(preset.maxN >= 1)
    })

    it('lists unique params known to the image API', () => {
      expect(new Set(preset.params).size).toBe(preset.params.length)

      expect(
        preset.params.every((param) => {
          return IMAGE_PARAMS.includes(param)
        }),
      ).toBe(true)
    })
  })
})
