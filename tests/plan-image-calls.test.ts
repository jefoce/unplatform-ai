import { describe, expect, it } from 'vitest'

import { planImageCalls } from '../src/core/plan-image-calls'
import type { ImagePreset } from '../src/core/presets/image/types'
import { imagePreset } from './helpers/image-presets'

describe('planImageCalls', () => {
  it('sends one native call when the preset takes the whole count', () => {
    const openai = imagePreset('gpt-image-2')

    expect(planImageCalls(4, openai)).toEqual([4])
  })

  it('sends one call per image when the preset takes only one', () => {
    const gemini = imagePreset('gemini-3.1-flash-image')

    expect(planImageCalls(4, gemini)).toEqual([1, 1, 1, 1])
  })

  it('sends one call per image when the preset params include seed', () => {
    const lite = imagePreset('seedream-5-0-lite')

    expect(planImageCalls(4, lite)).toEqual([1, 1, 1, 1])

    expect(planImageCalls(5, lite)).toEqual([1, 1, 1, 1, 1])
  })

  it('chunks a batching preset at maxN', () => {
    const openai = imagePreset('gpt-image-2')

    expect(planImageCalls(12, openai)).toEqual([10, 2])
  })

  it('handles a single image', () => {
    const flux = imagePreset('flux-3-image-klein')

    expect(planImageCalls(1, flux)).toEqual([1])
  })

  it('rejects counts and presets outside the plan', () => {
    const lite = imagePreset('seedream-5-0-lite')
    const broken: ImagePreset = { ...lite, maxN: 0 }

    expect(() => {
      planImageCalls(0, lite)
    }).toThrow(RangeError)

    expect(() => {
      planImageCalls(1.5, lite)
    }).toThrow(RangeError)

    expect(() => {
      planImageCalls(1, broken)
    }).toThrow(RangeError)
  })
})
