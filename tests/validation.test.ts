import { describe, expect, it } from 'vitest'

import { getPreset } from '@/core/presets'
import type { Resolution } from '@/core/presets/types'
import { validateInput } from '@/core/validation'

import { input, preset, upload, uploadsOf } from './helpers/validation-fixtures'

describe('validateInput prompt', () => {
  it('accepts a text-only references job', () => {
    const result = validateInput({ input: input(), uploads: {}, preset })

    expect(result).toEqual({ ok: true, errors: [], warnings: [] })
  })

  it('requires a prompt with a start frame by default', () => {
    const result = validateInput({
      input: input({
        tab: 'frames',
        prompt: '',
        aspectRatio: 'auto',
        frames: { start: 'start', end: null },
      }),
      uploads: uploadsOf(upload('start', 'image')),
      preset,
    })

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('Prompt is required')
  })

  it('accepts an empty prompt when the preset marks it optional and a start frame exists', () => {
    const optional = { ...preset, promptOptional: true }

    const result = validateInput({
      input: input({
        tab: 'frames',
        prompt: '',
        aspectRatio: 'auto',
        frames: { start: 'start', end: null },
      }),
      uploads: uploadsOf(upload('start', 'image')),
      preset: optional,
    })

    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects an empty prompt with an optional preset and no start frame', () => {
    const optional = { ...preset, promptOptional: true }

    const result = validateInput({
      input: input({
        tab: 'frames',
        prompt: '',
        aspectRatio: 'auto',
        frames: { start: null, end: null },
      }),
      uploads: {},
      preset: optional,
    })

    expect(result.errors).toContain('Prompt is required')
  })

  it('requires a prompt without a start frame', () => {
    const result = validateInput({ input: input({ prompt: '   ' }), uploads: {}, preset })

    expect(result.errors).toContain('Prompt is required')
  })

  it('rejects a prompt over preset.promptMaxChars', () => {
    const result = validateInput({
      input: input({ prompt: 'a'.repeat(preset.promptMaxChars + 1) }),
      uploads: {},
      preset,
    })

    expect(result.ok).toBe(false)
    expect(result.errors[0]).toContain('prompt')
  })
})

describe('validateInput duration', () => {
  it('rejects a non-integer or out-of-range duration', () => {
    const low = validateInput({ input: input({ duration: 1 }), uploads: {}, preset })

    const fractional = validateInput({
      input: input({ duration: 5.5 }),
      uploads: {},
      preset,
    })

    const high = validateInput({ input: input({ duration: 31 }), uploads: {}, preset })

    expect(low.ok).toBe(false)
    expect(low.errors[0]).toContain('duration')
    expect(fractional.ok).toBe(false)
    expect(high.ok).toBe(false)
  })

  it('rejects a duration below the billing floor', () => {
    const wanLow = validateInput({ input: input({ duration: 2 }), uploads: {}, preset })

    expect(wanLow.ok).toBe(false)
    expect(wanLow.errors).toContain('duration: Minimum 5s')

    const seedance = getPreset('seedance-2.0')

    const seedanceLow = validateInput({
      input: input({ presetId: seedance.id, duration: 2 }),
      uploads: {},
      preset: seedance,
    })

    expect(seedanceLow.ok).toBe(false)
    expect(seedanceLow.errors).toContain('duration: Minimum 4s')
  })

  it('accepts any integer between the minimum and the preset max', () => {
    const optionPreset = {
      ...preset,
      duration: { min: 4, max: 8, default: 6, options: [4, 6, 8] as const },
    }

    expect(
      validateInput({ input: input({ duration: 5 }), uploads: {}, preset: optionPreset }).ok,
    ).toBe(true)

    const result = validateInput({
      input: input({ duration: 9 }),
      uploads: {},
      preset: optionPreset,
    })

    expect(result.ok).toBe(false)
    expect(result.errors[0]).toContain('duration')
  })
})

describe('validateInput resolution and aspect', () => {
  it('rejects an unsupported resolution', () => {
    const result = validateInput({
      input: input({ resolution: '4k' as Resolution }),
      uploads: {},
      preset,
    })

    expect(result.ok).toBe(false)
    expect(result.errors[0]).toContain('resolution')
  })

  it('accepts resolutions from the new enum', () => {
    const wide = {
      ...preset,
      resolutions: ['720p', '4K'] as const,
      defaultResolution: '4K' as const,
    }

    expect(
      validateInput({ input: input({ resolution: '4K' }), uploads: {}, preset: wide }).ok,
    ).toBe(true)
  })

  it('allows Seedance 2.0 9:21 only at 720p', () => {
    const seedance = getPreset('seedance-2.0')

    const wide = validateInput({
      input: input({ presetId: seedance.id, aspectRatio: '9:21', resolution: '720p' }),
      uploads: {},
      preset: seedance,
    })

    expect(wide.ok).toBe(true)

    const hd = validateInput({
      input: input({ presetId: seedance.id, aspectRatio: '9:21', resolution: '1080p' }),
      uploads: {},
      preset: seedance,
    })

    expect(hd.errors).toContain('Aspect 9:21 is only available at 720p')
  })

  it('rejects auto aspect on the references tab', () => {
    const result = validateInput({
      input: input({ aspectRatio: 'auto' }),
      uploads: {},
      preset,
    })

    expect(result.errors).toContain('Auto aspect ratio needs a start frame')
  })
})

describe('validateInput model status', () => {
  it.each([
    ['missing', 'Not available on OpenRouter right now.'],
    ['no_provider', 'Add your OpenRouter key in Settings.'],
  ] as const)('puts the catalog reason first when the model is %s', (modelStatus, modelReason) => {
    const result = validateInput({
      input: input({ prompt: '' }),
      uploads: {},
      preset,
      ctx: { modelStatus, modelReason },
    })

    expect(result.ok).toBe(false)
    expect(result.errors[0]).toBe(modelReason)
  })

  it('does not block an unverified model', () => {
    const result = validateInput({
      input: input(),
      uploads: {},
      preset,
      ctx: { modelStatus: 'unverified', modelReason: null },
    })

    expect(result).toEqual({ ok: true, errors: [], warnings: [] })
  })

  it('does not block while the catalog is undefined', () => {
    const result = validateInput({ input: input(), uploads: {}, preset })

    expect(result).toEqual({ ok: true, errors: [], warnings: [] })
  })
})

describe('validateInput frames', () => {
  it('rejects an end frame without a start frame', () => {
    const result = validateInput({
      input: input({ tab: 'frames', prompt: '', frames: { start: null, end: 'end' } }),
      uploads: uploadsOf(upload('end', 'image')),
      preset,
    })

    expect(result.errors).toContain('Add a start frame first')
  })

  it('rejects an end frame when the preset disables it', () => {
    const noEnd = { ...preset, frames: { start: true, end: false } }

    const result = validateInput({
      input: input({ tab: 'frames', prompt: '', frames: { start: 'start', end: 'end' } }),
      uploads: uploadsOf(upload('start', 'image'), upload('end', 'image')),
      preset: noEnd,
    })

    expect(result.errors).toContain('End frame is not supported by this model')
  })

  it('rejects a frame upload id that does not exist', () => {
    const result = validateInput({
      input: input({ tab: 'frames', prompt: '', frames: { start: 'missing', end: null } }),
      uploads: {},
      preset,
    })

    expect(result.errors).toContain('Start frame file not found')
  })

  it('rejects a non-image frame', () => {
    const result = validateInput({
      input: input({ tab: 'frames', prompt: '', frames: { start: 'start', end: null } }),
      uploads: uploadsOf(upload('start', 'video')),
      preset,
    })

    expect(result.errors).toContain('Start frame must be an image')
  })

  it('rejects a missing frame file with its original name', () => {
    const result = validateInput({
      input: input({ tab: 'frames', prompt: '', frames: { start: 'start', end: null } }),
      uploads: uploadsOf(upload('start', 'image', { missing: true, originalName: 'lost.png' })),
      preset,
    })

    expect(result.errors).toContain('File missing: lost.png')
  })

  it('allows slot tokens in frames mode as plain text', () => {
    const result = validateInput({
      input: input({ tab: 'frames', prompt: '@Image 1', frames: { start: 'start', end: null } }),
      uploads: uploadsOf(upload('start', 'image')),
      preset,
    })

    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('applies image limits to frame uploads', () => {
    const result = validateInput({
      input: input({ tab: 'frames', prompt: 'A cat', frames: { start: 'start', end: null } }),
      uploads: uploadsOf(
        upload('start', 'image', { width: 200, height: 400, originalName: 'small.png' }),
      ),
      preset,
    })

    expect(result.errors).toContain('Image too small: 200 px, min 240 px (small.png)')
  })
})
