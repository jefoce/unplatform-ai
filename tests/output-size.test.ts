import { describe, expect, it } from 'vitest'

import { aspectAllowed, outputSize, SHORT_SIDE } from '@/core/output-size'
import { getPreset } from '@/core/presets'
import type { AspectRatio } from '@/core/presets/types'

const seedance = getPreset('seedance-2.0')
const seedance25 = getPreset('seedance-2.5')
const wan = getPreset('wan-3.0')

describe('outputSize', () => {
  it('hits exact preset table sizes', () => {
    expect(outputSize({ preset: seedance, resolution: '720p', aspect: '16:9' })).toEqual({
      width: 1280,
      height: 720,
    })

    expect(outputSize({ preset: seedance, resolution: '4K', aspect: '21:9' })).toEqual({
      width: 5040,
      height: 2160,
    })

    expect(outputSize({ preset: seedance25, resolution: '480p', aspect: '4:3' })).toEqual({
      width: 752,
      height: 560,
    })
  })

  it('falls back to the formula for unlisted ratios', () => {
    expect(outputSize({ preset: seedance, resolution: '720p', aspect: '9:21' })).toEqual({
      width: 720,
      height: 1680,
    })

    expect(outputSize({ preset: wan, resolution: '1080p', aspect: '21:9' })).toEqual({
      width: 2520,
      height: 1080,
    })
  })

  it('allows 9:21 on Seedance 2.0 only at 720p', () => {
    expect(aspectAllowed({ preset: seedance, resolution: '720p', aspect: '9:21' })).toBe(true)
    expect(aspectAllowed({ preset: seedance, resolution: '1080p', aspect: '9:21' })).toBe(false)
    expect(aspectAllowed({ preset: seedance, resolution: '480p', aspect: '9:21' })).toBe(false)
    expect(aspectAllowed({ preset: seedance, resolution: '720p', aspect: '16:9' })).toBe(true)
  })

  it('uses the aspect list when the preset has no size table', () => {
    expect(aspectAllowed({ preset: wan, resolution: '1080p', aspect: '16:9' })).toBe(true)
    expect(aspectAllowed({ preset: wan, resolution: '1080p', aspect: '9:21' })).toBe(false)
  })

  it('keeps both dimensions even', () => {
    const size = outputSize({ preset: wan, resolution: '480p', aspect: '3:2' })

    expect(size?.width).toBe(720)
    expect(size?.height).toBe(480)
    const odd = outputSize({ preset: wan, resolution: '480p', aspect: '9:16' })

    expect(odd?.width).toBe(480)
    expect(odd?.height).toBe(854)
  })

  it('returns null for a malformed aspect', () => {
    expect(outputSize({ preset: wan, resolution: '720p', aspect: 'bad' as AspectRatio })).toBeNull()
  })

  it('exports the short-side map', () => {
    expect(SHORT_SIDE['4K']).toBe(2160)
    expect(SHORT_SIDE['2K']).toBe(1440)
  })
})
