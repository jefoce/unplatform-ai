import { describe, expect, it } from 'vitest'

import { getPreset } from '@/core/presets'
import { validateInput } from '@/core/validation'
import type { ValidationIssue } from '@/core/validation-types'

import { input, preset, upload, uploadsOf } from './helpers/validation-fixtures'

describe('validateInput reference counts', () => {
  it('accepts a references job with mixed kinds', () => {
    const uploads = uploadsOf(
      upload('img', 'image'),
      upload('vid', 'video', { durationSec: 5 }),
      upload('aud', 'audio', { durationSec: 3 }),
    )

    const result = validateInput({
      input: input({
        prompt: 'The woman from @Image 1 walks with @Video 1.',
        references: ['img', 'vid', 'aud'],
      }),
      uploads,
      preset,
      ctx: { modelStatus: 'unverified', modelReason: null, remoteConfigured: true },
    })

    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('accepts image references on Wan Prime', () => {
    const result = validateInput({
      input: input({ presetId: 'wan-3.0-prime', references: ['img'] }),
      uploads: uploadsOf(upload('img', 'image')),
      preset: getPreset('wan-3.0-prime'),
    })

    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects too many images', () => {
    const images = Array.from({ length: 11 }, (_, i) => {
      return `img${i}`
    })

    const uploads = uploadsOf(
      ...images.map((id) => {
        return upload(id, 'image')
      }),
    )

    const result = validateInput({ input: input({ references: images }), uploads, preset })

    expect(result.errors).toContain('Too many images (11, max 10)')
  })

  it('rejects too many videos on Seedance 2.0', () => {
    const ids = ['v1', 'v2', 'v3', 'v4']

    const result = validateInput({
      input: input({ presetId: 'seedance-2.0', references: ids }),
      uploads: uploadsOf(
        ...ids.map((id) => {
          return upload(id, 'video', { durationSec: 2 })
        }),
      ),
      preset: getPreset('seedance-2.0'),
    })

    expect(result.errors).toContain('Too many videos (4, max 3)')
  })

  it('rejects audio-only references on Seedance', () => {
    const result = validateInput({
      input: input({ presetId: 'seedance-2.0', references: ['a'] }),
      uploads: uploadsOf(upload('a', 'audio', { durationSec: 3 })),
      preset: getPreset('seedance-2.0'),
    })

    expect(result.errors).toContain('Audio references need at least one image or video reference')
  })
})

describe('validateInput reference storage', () => {
  it('skips the cloud storage error while remote status is unknown', () => {
    const result = validateInput({
      input: input({ references: ['vid'] }),
      uploads: uploadsOf(upload('vid', 'video', { durationSec: 5 })),
      preset,
    })

    expect(result.errors).toEqual([])
  })

  it('warns when cloud storage is explicitly missing', () => {
    const result = validateInput({
      input: input({ references: ['vid'] }),
      uploads: uploadsOf(upload('vid', 'video', { durationSec: 5 })),
      preset,
      ctx: { modelStatus: 'unverified', modelReason: null, remoteConfigured: false },
    })

    expect(result.errors).toContain(
      'Video references for Wan 3.0 need cloud storage (R2) configured',
    )
  })

  it('rejects a video reference below the per-video minimum', () => {
    const result = validateInput({
      input: input({ presetId: 'seedance-2.0', references: ['v'] }),
      uploads: uploadsOf(upload('v', 'video', { durationSec: 1.5 })),
      preset: getPreset('seedance-2.0'),
    })

    expect(result.errors).toContain('Video 1 is 1.5s, min 2s')
  })
})

describe('validateInput reference durations', () => {
  it('rejects video references over the total duration', () => {
    const uploads = uploadsOf(
      upload('v1', 'video', { durationSec: 10 }),
      upload('v2', 'video', { durationSec: 10 }),
    )

    const result = validateInput({
      input: input({ references: ['v1', 'v2'] }),
      uploads,
      preset,
    })

    expect(result.errors).toContain('Video references are too long in total (20s, max 15s)')
  })

  it('rejects audio references over the total duration', () => {
    const uploads = uploadsOf(
      upload('a1', 'audio', { durationSec: 10 }),
      upload('a2', 'audio', { durationSec: 10 }),
    )

    const result = validateInput({
      input: input({ references: ['a1', 'a2'] }),
      uploads,
      preset,
    })

    expect(result.errors).toContain('Audio references are too long in total (20s, max 15s)')
  })

  it('rejects a video reference plus output over the combined limit', () => {
    const result = validateInput({
      input: input({ duration: 30, references: ['v'] }),
      uploads: uploadsOf(upload('v', 'video', { durationSec: 6.8 })),
      preset,
      ctx: { modelStatus: 'unverified', modelReason: null, remoteConfigured: true },
    })

    expect(result.errors).toContain('Max 23s: reference videos are 6.8s in total, limit 30s')
  })

  it('rejects output over the combined limit for two 7s clips', () => {
    const result = validateInput({
      input: input({ duration: 20, references: ['v1', 'v2'] }),
      uploads: uploadsOf(
        upload('v1', 'video', { durationSec: 7 }),
        upload('v2', 'video', { durationSec: 7 }),
      ),
      preset,
      ctx: { modelStatus: 'unverified', modelReason: null, remoteConfigured: true },
    })

    expect(result.errors).toContain('Max 16s: reference videos are 14s in total, limit 30s')
  })

  it('rejects a 15.02s clip over a strict 15s limit', () => {
    const result = validateInput({
      input: input({ references: ['v'] }),
      uploads: uploadsOf(upload('v', 'video', { durationSec: 15.02 })),
      preset,
      ctx: { modelStatus: 'unverified', modelReason: null, remoteConfigured: true },
    })

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('Video 1 is 15.02s, max 15s')
    expect(result.errors).toContain('Video references are too long in total (15.02s, max 15s)')
  })

  it('rejects a 15.2s clip over a 15s limit', () => {
    const result = validateInput({
      input: input({ references: ['v'] }),
      uploads: uploadsOf(upload('v', 'video', { durationSec: 15.2 })),
      preset,
      ctx: { modelStatus: 'unverified', modelReason: null, remoteConfigured: true },
    })

    expect(result.errors).toEqual([
      'Video 1 is 15.2s, max 15s',
      'Video references are too long in total (15.2s, max 15s)',
    ])
  })

  it('skips the input plus output rule when the preset disables it', () => {
    const result = validateInput({
      input: input({ presetId: 'seedance-2.0', duration: 15, references: ['v'] }),
      uploads: uploadsOf(upload('v', 'video', { durationSec: 10 })),
      preset: getPreset('seedance-2.0'),
      ctx: { modelStatus: 'unverified', modelReason: null, remoteConfigured: true },
    })

    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })
})

describe('validateInput reference slots and files', () => {
  it('warns when a slot has no matching reference', () => {
    const result = validateInput({
      input: input({ prompt: 'Use @Image 3 and Image 3', references: ['i1', 'i2'] }),
      uploads: uploadsOf(upload('i1', 'image'), upload('i2', 'image')),
      preset,
    })

    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])

    expect(result.warnings).toEqual<ValidationIssue[]>([
      { type: 'missing-slot', slot: { kind: 'image', n: 3 }, attached: 2 },
    ])
  })

  it('does not warn when the literal label matches a reference', () => {
    const result = validateInput({
      input: input({ prompt: 'Use @Image 1', references: ['i1'] }),
      uploads: uploadsOf(upload('i1', 'image')),
      preset,
    })

    expect(result.warnings).toEqual([])
  })

  it('warns instead of failing for a slot past the attached references', () => {
    const result = validateInput({
      input: input({ prompt: 'Look at @Image 2', references: ['ref'] }),
      uploads: uploadsOf(upload('ref', 'image')),
      preset,
    })

    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])

    expect(result.warnings).toEqual<ValidationIssue[]>([
      { type: 'missing-slot', slot: { kind: 'image', n: 2 }, attached: 1 },
    ])
  })

  it('rejects a referenced upload that does not exist', () => {
    const result = validateInput({
      input: input({ references: ['nope'] }),
      uploads: {},
      preset,
    })

    expect(result.errors).toContain('Reference file not found')
  })

  it('rejects a missing referenced file', () => {
    const result = validateInput({
      input: input({ references: ['ref'] }),
      uploads: uploadsOf(upload('ref', 'image', { missing: true, originalName: 'gone.png' })),
      preset,
    })

    expect(result.errors).toContain('File missing: gone.png')
  })
})
