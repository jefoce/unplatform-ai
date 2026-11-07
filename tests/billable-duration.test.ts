import { describe, expect, it } from 'vitest'

import { normalizeForPreset } from '../src/core/normalize-input'
import { getPreset, minDuration } from '../src/core/presets'
import { billableSeconds } from '../src/core/pricing/quote'
import type { GenerationInput } from '../src/core/schemas/generation-record'
import type { UploadItem } from '../src/core/schemas/upload-item'
import { validateInput } from '../src/core/validation/video'

const wan = getPreset('wan-3.0')
const prime = getPreset('wan-3.0-prime')
const seedance = getPreset('seedance-2.0')
const seedance25 = getPreset('seedance-2.5')

/** Same reference cap as Wan, without the quick-pick duration steps. */
const continuous = {
  ...wan,
  duration: { min: wan.duration.min, max: wan.duration.max, default: wan.duration.default },
}

const draft = (presetId: string, duration: number, references: string[] = []): GenerationInput => {
  return {
    presetId,
    tab: 'references',
    prompt: 'A cat',
    audio: true,
    duration,
    aspectRatio: '16:9',
    resolution: '1080p',
    frames: { start: null, end: null },
    references,
    seed: null,
  }
}

const videoReference = (id: string): UploadItem => {
  return {
    id,
    source: 'file',
    kind: 'video',
    mime: 'video/mp4',
    ext: 'mp4',
    originalName: `${id}.mp4`,
    sizeBytes: 1024,
    durationSec: 7,
    createdAt: '2026-10-20T00:00:00.000Z',
  }
}

describe('billableSeconds', () => {
  it('bills Wan at the 5 second floor', () => {
    expect(billableSeconds(wan, 2)).toBe(5)
    expect(billableSeconds(wan, 5)).toBe(5)
    expect(billableSeconds(wan, 10)).toBe(10)
  })

  it('bills Prime at the 5 second floor', () => {
    expect(billableSeconds(prime, 2)).toBe(5)
    expect(billableSeconds(prime, 10)).toBe(10)
  })

  it('bills Seedance at the requested duration', () => {
    expect(billableSeconds(seedance, 2)).toBe(2)
    expect(billableSeconds(seedance, 4)).toBe(4)
    expect(billableSeconds(seedance, 10)).toBe(10)
    expect(billableSeconds(seedance25, 2)).toBe(2)
    expect(billableSeconds(seedance25, 4)).toBe(4)
    expect(billableSeconds(seedance25, 10)).toBe(10)
  })
})

describe('minDuration', () => {
  it('raises Wan to the 5 second billing floor', () => {
    expect(minDuration(wan)).toBe(5)
    expect(minDuration(prime)).toBe(5)
  })

  it('keeps Seedance at its 4 second minimum', () => {
    expect(minDuration(seedance)).toBe(4)
    expect(minDuration(seedance25)).toBe(4)
  })
})

describe('duration normalization', () => {
  it('raises a 2s Wan draft to the floor and notes it', () => {
    const result = normalizeForPreset({ input: draft('wan-3.0', 2), preset: wan })

    expect(result.input.duration).toBe(5)
    expect(result.notes).toEqual(['Duration set to 5s'])
  })

  it('raises a 2s Seedance draft to its minimum and notes it', () => {
    const result = normalizeForPreset({ input: draft('seedance-2.0', 2), preset: seedance })

    expect(result.input.duration).toBe(4)
    expect(result.notes).toEqual(['Duration set to 4s'])
  })

  it('allows any integer up to the exact reference limit', () => {
    const uploads = { v1: videoReference('v1') }

    const allowed = normalizeForPreset({
      input: draft('wan-3.0', 23, ['v1']),
      preset: continuous,
      uploads,
    })

    expect(allowed.input.duration).toBe(23)
    expect(allowed.notes).toEqual([])

    const valid = validateInput({
      input: draft('wan-3.0', 23, ['v1']),
      uploads,
      preset: continuous,
      ctx: { modelStatus: 'unverified', modelReason: null, remoteConfigured: true },
    })

    expect(valid.ok).toBe(true)

    const over = normalizeForPreset({
      input: draft('wan-3.0', 24, ['v1']),
      preset: continuous,
      uploads,
    })

    expect(over.input.duration).toBe(23)
    expect(over.notes).toEqual(['Duration set to 23s'])

    const rejected = validateInput({
      input: draft('wan-3.0', 24, ['v1']),
      uploads,
      preset: continuous,
      ctx: { modelStatus: 'unverified', modelReason: null, remoteConfigured: true },
    })

    expect(rejected.ok).toBe(false)
    expect(rejected.errors).toContain('Max 23s: reference videos are 7s in total, limit 30s')
  })
})

describe('duration steps', () => {
  const stepped = { ...seedance, duration: { min: 5, max: 9, default: 5, options: [5, 9] } }

  it('accepts only the allowed duration steps', () => {
    const allowed = [5, 9].map((duration) => {
      return validateInput({ input: draft('seedance-2.0', duration), uploads: {}, preset: stepped })
    })

    expect(
      allowed.every((result) => {
        return result.ok
      }),
    ).toBe(true)

    const rejected = validateInput({
      input: draft('seedance-2.0', 6),
      uploads: {},
      preset: stepped,
    })

    expect(rejected.ok).toBe(false)
    expect(rejected.errors).toContain('duration: Choose an allowed duration')
  })
})
