import { isNil, uniq } from 'lodash-es'
import { describe, expect, it } from 'vitest'

import { assertDeclaredFields } from '@/server/providers/mock/images'
import { buildImageBody } from '@/server/providers/openrouter/images'
import type { ImageReferencePayload } from '@/server/providers/types'

import { IMAGE_COUNT_MAX, IMAGE_REFERENCE_MAX } from '../src/core/constants'
import { IMAGE_PRESETS } from '../src/core/presets/image'
import type {
  ImageAspectChoice,
  ImageBackground,
  ImageOption,
  ImagePreset,
  ImageQuality,
} from '../src/core/presets/image/types'
import type { ImageGenerationInput } from '../src/core/schemas/image-record'
import { validateImageSettings } from '../src/core/validation/image'

interface AxisValues {
  resolutions: (string | null)[]
  qualities: (ImageQuality | null)[]
  backgrounds: (ImageBackground | null)[]
  aspects: ImageAspectChoice[]
  counts: number[]
  referenceCounts: number[]
}

interface FuzzCase {
  preset: ImagePreset
  input: ImageGenerationInput
  references: ImageReferencePayload[]
}

function optionValues<T extends string>(set: readonly ImageOption<T>[] | null): (T | null)[] {
  if (isNil(set)) {
    return [null]
  }

  return set.map((option) => {
    return option.value
  })
}

function axesFor(preset: ImagePreset): AxisValues {
  const aspects = uniq([
    preset.defaultAspectRatio,
    ...preset.aspectRatios.slice(0, 2),
    ...preset.aspectRatios.slice(-1),
  ])

  return {
    resolutions: optionValues(preset.resolutions),
    qualities: optionValues(preset.qualities),
    backgrounds: optionValues(preset.backgrounds),
    aspects,
    counts: uniq([1, Math.min(preset.maxN, IMAGE_COUNT_MAX), IMAGE_COUNT_MAX]),
    referenceCounts: uniq([0, Math.min(preset.referenceMax, IMAGE_REFERENCE_MAX)]),
  }
}

function comboCount(axes: AxisValues): number {
  return (
    axes.resolutions.length *
    axes.qualities.length *
    axes.backgrounds.length *
    axes.aspects.length *
    axes.counts.length *
    axes.referenceCounts.length
  )
}

function pickAxis<T>(values: readonly T[], index: number): T {
  if (values.length === 0) {
    throw new Error('Empty fuzz axis')
  }

  return values[index % values.length] as T
}

function caseAt(preset: ImagePreset, axes: AxisValues, index: number): FuzzCase {
  let cursor = index

  const resolution = pickAxis(axes.resolutions, cursor)

  cursor = Math.floor(cursor / axes.resolutions.length)

  const quality = pickAxis(axes.qualities, cursor)

  cursor = Math.floor(cursor / axes.qualities.length)

  const background = pickAxis(axes.backgrounds, cursor)

  cursor = Math.floor(cursor / axes.backgrounds.length)

  const aspectRatio = pickAxis(axes.aspects, cursor)

  cursor = Math.floor(cursor / axes.aspects.length)

  const count = pickAxis(axes.counts, cursor)

  cursor = Math.floor(cursor / axes.counts.length)

  const referenceCount = pickAxis(axes.referenceCounts, cursor)

  const references = Array.from({ length: referenceCount }, (_, referenceIndex) => {
    return { id: `ref-${referenceIndex}`, dataUrl: 'data:image/png;base64,AAAA' }
  })

  return {
    preset,
    input: {
      presetId: preset.id,
      prompt: 'a cat',
      count,
      aspectRatio,
      resolution,
      quality,
      background,
      references: references.map((reference) => {
        return reference.id
      }),
      seed: preset.seed ? 42 : null,
    },
    references,
  }
}

function fuzzCases(): FuzzCase[] {
  const cases: FuzzCase[] = []

  for (const preset of IMAGE_PRESETS) {
    const axes = axesFor(preset)
    const total = comboCount(axes)

    for (let index = 0; index < total; index += 1) {
      cases.push(caseAt(preset, axes, index))
    }
  }

  return cases
}

const CASES = fuzzCases()

describe('image body fuzz', () => {
  it(`passes every preset and control combination (${CASES.length} cases)`, () => {
    for (const { preset, input, references } of CASES) {
      const label = `${preset.id} ${input.resolution ?? 'no-resolution'} n=${input.count}`

      expect(validateImageSettings(preset, input), label).toEqual([])

      const body = buildImageBody({ preset, input, references })
      const declared = new Set(['model', 'prompt', ...preset.params])

      expect(
        Object.keys(body).every((key) => {
          return declared.has(key)
        }),
        label,
      ).toBe(true)

      expect(() => {
        assertDeclaredFields({ preset, input, references })
      }, label).not.toThrow()
    }
  })
})
