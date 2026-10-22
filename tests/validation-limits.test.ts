import { describe, expect, it } from 'vitest'

import { getPreset } from '@/core/presets'
import { validateInput } from '@/core/validation'

import { input, MB, preset, upload, uploadsOf } from './helpers/validation-fixtures'

describe('validateInput remote storage', () => {
  it('flags Seedance video references when remote storage is not configured', () => {
    const result = validateInput({
      input: input({ presetId: 'seedance-2.0', references: ['v'] }),
      uploads: uploadsOf(upload('v', 'video', { durationSec: 5 })),
      preset: getPreset('seedance-2.0'),
      ctx: { remoteConfigured: false },
    })

    expect(result.errors).toContain(
      'Video references for Seedance 2.0 need cloud storage (R2) configured',
    )
  })

  it('accepts Seedance video references when remote storage is configured', () => {
    const result = validateInput({
      input: input({ presetId: 'seedance-2.0', references: ['v'] }),
      uploads: uploadsOf(upload('v', 'video', { durationSec: 5 })),
      preset: getPreset('seedance-2.0'),
      ctx: { remoteConfigured: true },
    })

    expect(result.ok).toBe(true)
  })

  it('requires cloud storage for Wan video references', () => {
    const result = validateInput({
      input: input({ references: ['v'] }),
      uploads: uploadsOf(upload('v', 'video', { durationSec: 5 })),
      preset,
      ctx: { remoteConfigured: false },
    })

    expect(result.errors).toContain(
      'Video references for Wan 3.0 need cloud storage (R2) configured',
    )
  })

  it('skips the R2 warning while remote status is loading', () => {
    const result = validateInput({
      input: input({ references: ['v'] }),
      uploads: uploadsOf(upload('v', 'video', { durationSec: 5 })),
      preset,
    })

    expect(result.errors).not.toContain(
      'Video references for Wan 3.0 need cloud storage (R2) configured',
    )
  })

  it('requires cloud storage for Wan audio references', () => {
    const result = validateInput({
      input: input({ references: ['a'] }),
      uploads: uploadsOf(upload('a', 'audio', { durationSec: 5 })),
      preset,
      ctx: { remoteConfigured: false },
    })

    expect(result.errors).toContain(
      'Audio references for Wan 3.0 need cloud storage (R2) configured',
    )
  })
})

describe('validateInput submit and inline limits', () => {
  it('rejects a submit while four jobs are active', () => {
    const result = validateInput({ input: input(), uploads: {}, preset, ctx: { activeCount: 4 } })

    expect(result.errors).toContain('4 videos already generating. Wait for one to finish.')
  })

  it('rejects an oversized video reference sent inline', () => {
    const inline = {
      ...preset,
      inputTransport: { image: 'base64', video: 'base64', audio: 'base64' },
    } as const
    const result = validateInput({
      input: input({ references: ['v'] }),
      uploads: uploadsOf(upload('v', 'video', { sizeBytes: 60 * MB })),
      preset: inline,
    })

    expect(result.errors).toContain('Reference too large to send inline (60 MB, max 50 MB)')
  })

  it('allows a large video reference sent by link', () => {
    const result = validateInput({
      input: input({ presetId: 'seedance-2.0', references: ['v'] }),
      uploads: uploadsOf(upload('v', 'video', { sizeBytes: 60 * MB, durationSec: 5 })),
      preset: getPreset('seedance-2.0'),
      ctx: { remoteConfigured: true },
    })

    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })
})

describe('validateInput media limits', () => {
  it('warns about a low resolution image', () => {
    const result = validateInput({
      input: input({ references: ['img'] }),
      uploads: uploadsOf(upload('img', 'image', { width: 250, height: 400 })),
      preset,
    })

    expect(result.ok).toBe(true)
    expect(result.warnings).toContainEqual({
      type: 'text',
      text: 'Low resolution input, output may look soft',
    })
  })

  it('rejects a Wan image below the minimum side', () => {
    const result = validateInput({
      input: input({ references: ['img'] }),
      uploads: uploadsOf(
        upload('img', 'image', { width: 200, height: 400, originalName: 'logo.png' }),
      ),
      preset,
    })

    expect(result.errors).toContain('Image too small: 200 px, min 240 px (logo.png)')
  })

  it('rejects a Wan video beyond the maximum side', () => {
    const result = validateInput({
      input: input({ references: ['v'] }),
      uploads: uploadsOf(
        upload('v', 'video', { width: 4800, height: 2160, originalName: 'drone.mov' }),
      ),
      preset,
      ctx: { remoteConfigured: true },
    })

    expect(result.errors).toContain('Video too large: 4800 px, max 4096 px (drone.mov)')
  })

  it('rejects a Wan image beyond the maximum aspect', () => {
    const result = validateInput({
      input: input({ references: ['img'] }),
      uploads: uploadsOf(
        upload('img', 'image', { width: 900, height: 100, originalName: 'banner.png' }),
      ),
      preset,
    })

    expect(result.errors).toContain('Image too narrow: 9:1, max 8:1 (banner.png)')
  })

  it('rejects a Wan video over the file size with rounded MB', () => {
    const result = validateInput({
      input: input({ references: ['v'] }),
      uploads: uploadsOf(upload('v', 'video', { sizeBytes: 140 * MB, originalName: 'drone.mov' })),
      preset,
      ctx: { remoteConfigured: true },
    })

    expect(result.errors).toContain('Video file too large: 140 MB, max 100 MB (drone.mov)')
  })

  it('rejects a Wan video with the wrong extension', () => {
    const result = validateInput({
      input: input({ references: ['v'] }),
      uploads: uploadsOf(upload('v', 'video', { ext: '.webm', originalName: 'clip.webm' })),
      preset,
      ctx: { remoteConfigured: true },
    })

    expect(result.errors).toContain('Wan 3.0 takes video references as mp4 or mov (clip.webm)')
  })

  it('rejects a Wan audio reference with the wrong extension', () => {
    const result = validateInput({
      input: input({ references: ['a'] }),
      uploads: uploadsOf(upload('a', 'audio', { ext: '.m4a', originalName: 'track.m4a' })),
      preset,
      ctx: { remoteConfigured: true },
    })

    expect(result.errors).toContain('Wan 3.0 takes audio references as wav or mp3 (track.m4a)')
  })
})
