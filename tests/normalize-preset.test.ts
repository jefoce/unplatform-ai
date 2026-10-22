import { describe, expect, it } from 'vitest'

import { normalizeForPreset } from '@/core/normalize-input'
import { getPreset } from '@/core/presets'

import { input, upload, uploadsOf, wan, withPreset } from './helpers/normalize-fixtures'

describe('normalizeForPreset duration', () => {
  it('clamps duration when the preset has no options', () => {
    const preset = withPreset({ duration: { min: 2, max: 30, default: 5 } })
    const result = normalizeForPreset({ input: input({ duration: 90 }), preset })

    expect(result.input.duration).toBe(30)
    expect(result.notes).toEqual(['Duration set to 30s'])
  })

  it('rounds to a whole second and treats options as quick picks', () => {
    const preset = withPreset({ duration: { min: 4, max: 8, default: 6, options: [4, 6, 8] } })

    expect(normalizeForPreset({ input: input({ duration: 5.5 }), preset }).input.duration).toBe(6)
    expect(normalizeForPreset({ input: input({ duration: 5.5 }), preset }).notes).toEqual([
      'Duration set to 6s',
    ])
    expect(normalizeForPreset({ input: input({ duration: 5 }), preset }).input.duration).toBe(5)
    expect(normalizeForPreset({ input: input({ duration: 8 }), preset }).notes).toEqual([])
  })

  it('caps duration by the total reference video time', () => {
    const result = normalizeForPreset({
      input: input({ duration: 20, references: ['v1', 'v2'] }),
      preset: wan,
      uploads: uploadsOf(
        upload('v1', 'video', { durationSec: 7 }),
        upload('v2', 'video', { durationSec: 7 }),
      ),
    })

    expect(result.input.duration).toBe(16)
    expect(result.notes).toContain('Duration set to 16s')
  })

  it('ignores video references when the combined rule is off', () => {
    const seedance = getPreset('seedance-2.0')
    const result = normalizeForPreset({
      input: input({ duration: 30, references: ['v'] }),
      preset: seedance,
      uploads: uploadsOf(upload('v', 'video', { durationSec: 10 })),
    })

    expect(result.input.duration).toBe(15)
  })
})

describe('normalizeForPreset format', () => {
  it('sets the preset id and leaves compatible input untouched', () => {
    const result = normalizeForPreset({
      input: input({ presetId: 'other', references: [] }),
      preset: wan,
    })

    expect(result.input.presetId).toBe('wan-3.0')
    expect(result.notes).toEqual([])
  })

  it('resets unsupported resolution and aspect ratio', () => {
    const result = normalizeForPreset({
      input: input({ resolution: '4K', aspectRatio: '21:9' }),
      preset: wan,
    })

    expect(result.input.resolution).toBe('1080p')
    expect(result.input.aspectRatio).toBe('16:9')
  })

  it('keeps auto only when frames allow it', () => {
    expect(
      normalizeForPreset({ input: input({ aspectRatio: 'auto' }), preset: wan }).input.aspectRatio,
    ).toBe('auto')
    const noAuto = withPreset({ autoAspectWithFrames: false })

    expect(
      normalizeForPreset({ input: input({ aspectRatio: 'auto' }), preset: noAuto }).input
        .aspectRatio,
    ).toBe('16:9')
  })

  it('turns audio off when the preset does not support it', () => {
    const silent = withPreset({ audio: { supported: false, default: false } })

    expect(normalizeForPreset({ input: input({ audio: true }), preset: silent }).input.audio).toBe(
      false,
    )
  })

  it('keeps the seed', () => {
    expect(normalizeForPreset({ input: input({ seed: 42 }), preset: wan }).input.seed).toBe(42)
  })
})

describe('normalizeForPreset frames', () => {
  it('clears the end frame when unsupported', () => {
    const noEnd = withPreset({ frames: { start: true, end: false } })
    const result = normalizeForPreset({
      input: input({ frames: { start: 'start', end: 'end' } }),
      preset: noEnd,
    })

    expect(result.input.frames).toEqual({ start: 'start', end: null })
  })

  it('clears both frames without a start frame', () => {
    const result = normalizeForPreset({
      input: input({ frames: { start: null, end: 'end' } }),
      preset: wan,
    })

    expect(result.input.frames).toEqual({ start: null, end: null })
  })
})
