import { describe, expect, it } from 'vitest'

import {
  ASPECT_RATIOS,
  DEFAULT_PRESET_ID,
  findPreset,
  getPreset,
  MODEL_PRESETS,
  RESOLUTIONS,
} from '@/core/presets'

describe('MODEL_PRESETS', () => {
  it('ships Wan and Seedance presets in order', () => {
    expect(MODEL_PRESETS.map((preset) => preset.id)).toEqual([
      'wan-3.0',
      'wan-3.0-prime',
      'seedance-2.0',
      'seedance-2.5',
    ])
    expect(DEFAULT_PRESET_ID).toBe('wan-3.0')
  })

  it('shares every Wan setting except identity and pricing', () => {
    const wan = getPreset('wan-3.0')
    const prime = getPreset('wan-3.0-prime')

    expect(prime.references).toEqual(wan.references)
    expect(prime.references).toEqual({
      image: 10,
      video: 5,
      audio: 5,
      videoTotalSec: 15,
      audioTotalSec: 15,
      videoMinSec: 1,
      videoMaxSec: 15,
      audioMinSec: 1,
      audioMaxSec: 15,
    })
    expect(prime.referenceLimits).toEqual(wan.referenceLimits)
    expect(prime.inputTransport).toEqual({
      image: 'base64',
      video: 'url',
      audio: 'url',
    })
    expect(prime.frames).toEqual(wan.frames)
    expect(prime.duration).toEqual(wan.duration)
    expect(prime.resolutions).toEqual(wan.resolutions)
    expect(prime.aspectRatios).toEqual(wan.aspectRatios)
  })

  it('exposes the new resolution and aspect lists', () => {
    expect(RESOLUTIONS).toContain('768p')
    expect(RESOLUTIONS).toContain('4K')
    expect(ASPECT_RATIOS).toContain('21:9')
    expect(ASPECT_RATIOS).toContain('9:21')
  })

  it('builds Wan per-second keys from the resolution', () => {
    const pricing = getPreset('wan-3.0').pricing

    if (pricing.kind !== 'perSecond') throw new Error('Wan must be per-second')

    expect(pricing.unit).toBe('usd')
    expect(pricing.key({ resolution: '1080p', audio: true, hasVideoInput: false })).toBe(
      'duration_seconds_1080p',
    )
    expect(pricing.fallback.duration_seconds_1080p).toBe(0.2)
  })

  it('keeps Wan reference labels plain', () => {
    expect(getPreset('wan-3.0').refLabel).toBe('{Kind} {n}')
    expect(getPreset('wan-3.0').maxInputPlusOutputSec).toBe(30)
  })
})

describe('Seedance presets', () => {
  it('defines Seedance 2.0 limits and sizes', () => {
    const preset = getPreset('seedance-2.0')

    expect(preset.slug).toBe('bytedance/seedance-2.0')
    expect(preset.duration).toEqual({ min: 4, max: 15, default: 5, options: [4, 5, 8, 10, 15] })
    expect(preset.defaultResolution).toBe('720p')
    expect(preset.resolutions).toEqual(['480p', '720p', '1080p', '4K'])
    expect(preset.references).toEqual({
      image: 9,
      video: 3,
      audio: 3,
      videoTotalSec: 15,
      audioTotalSec: 15,
      videoMinSec: 2,
      videoMaxSec: 15,
      audioMinSec: 2,
      audioMaxSec: 15,
      audioNeedsVisual: true,
    })
    expect(preset.maxInputPlusOutputSec).toBeNull()
    expect(preset.promptMaxChars).toBe(5000)
    expect(preset.refLabel).toBe('{Kind} {n}')
    expect(preset.outputSizes?.['720p']?.['16:9']).toBe('1280x720')
  })

  it('defines Seedance 2.5 limits and at-prefixed labels', () => {
    const preset = getPreset('seedance-2.5')

    expect(preset.slug).toBe('bytedance/seedance-2.5')
    expect(preset.duration.max).toBe(30)
    expect(preset.resolutions).toEqual(['480p', '720p'])
    expect(preset.references.image).toBe(30)
    expect(preset.references.video).toBe(10)
    expect(preset.refLabel).toBe('@{Kind} {n}')
    expect(preset.maxInputPlusOutputSec).toBeNull()
  })

  it('exposes family, icon and duration options', () => {
    const wan = getPreset('wan-3.0')

    expect(wan.family).toBe('wan')
    expect(wan.icon).toBe('sparkles')
    expect(wan.duration.options).toEqual([5, 10, 15, 20, 30])

    const seedance = getPreset('seedance-2.0')

    expect(seedance.family).toBe('seedance')
    expect(seedance.icon).toBe('audio-lines')
  })
})

describe('preset pricing', () => {
  it('uses video-token pricing for Seedance', () => {
    const pricing = getPreset('seedance-2.0').pricing

    if (pricing.kind !== 'videoTokens') throw new Error('Seedance must use tokens')

    expect(pricing.fps).toBe(24)
    expect(pricing.key({ resolution: '720p', audio: true, hasVideoInput: false })).toBe(
      'video_tokens',
    )
    expect(pricing.key({ resolution: '1080p', audio: true, hasVideoInput: false })).toBe(
      'video_tokens_1080p',
    )
    expect(pricing.key({ resolution: '4K', audio: true, hasVideoInput: false })).toBe(
      'video_tokens_4k',
    )
    expect(pricing.key({ resolution: '720p', audio: true, hasVideoInput: true })).toBe(
      'video_tokens_with_video_input',
    )
    expect(pricing.key({ resolution: '1080p', audio: true, hasVideoInput: true })).toBe(
      'video_tokens_1080p_with_video_input',
    )
    expect(pricing.fallback.video_tokens).toBe(0.000007)
  })
})

describe('findPreset', () => {
  it('returns null for unknown ids', () => {
    expect(findPreset('nope')).toBeNull()
  })

  it('getPreset falls back to the default for display', () => {
    expect(getPreset('nope').id).toBe(DEFAULT_PRESET_ID)
  })
})
