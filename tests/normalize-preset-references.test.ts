import { describe, expect, it } from 'vitest'

import { normalizeForPreset } from '@/core/normalize-input'
import { getPreset } from '@/core/presets'

import { input, upload, uploadsOf, withPreset } from './helpers/normalize-fixtures'

describe('normalizeForPreset references', () => {
  it('switches to frames when references are unsupported and keeps the list', () => {
    const noRefs = withPreset({
      references: { image: 0, video: 0, audio: 0, videoTotalSec: 0, audioTotalSec: 0 },
    })
    const result = normalizeForPreset({
      input: input({ tab: 'references', references: ['ref'] }),
      preset: noRefs,
    })

    expect(result.input.tab).toBe('frames')
    expect(result.input.references).toEqual(['ref'])
    expect(result.notes).toEqual(['References not supported by Wan 3.0'])
  })

  it('trims references per kind in order', () => {
    const preset = withPreset({
      references: { image: 1, video: 1, audio: 1, videoTotalSec: 15, audioTotalSec: 15 },
    })
    const result = normalizeForPreset({
      input: input({ references: ['i1', 'i2', 'v1', 'v2', 'a1', 'a2'] }),
      preset,
      uploads: uploadsOf(
        upload('i1', 'image'),
        upload('i2', 'image'),
        upload('v1', 'video'),
        upload('v2', 'video'),
        upload('a1', 'audio'),
        upload('a2', 'audio'),
      ),
    })

    expect(result.input.references).toEqual(['i1', 'v1', 'a1'])
    expect(result.notes).toEqual([
      'Removed 1 image reference',
      'Removed 1 video reference',
      'Removed 1 audio reference',
    ])
  })

  it('drops the tenth image when the preset image limit is nine', () => {
    const seedance = getPreset('seedance-2.0')
    const ids = Array.from({ length: 10 }, (_, i) => `i${i}`)
    const result = normalizeForPreset({
      input: input({ presetId: 'seedance-2.0', references: ids }),
      preset: seedance,
      uploads: uploadsOf(...ids.map((id) => upload(id, 'image'))),
    })

    expect(result.input.references).toEqual(ids.slice(0, 9))
    expect(result.notes).toEqual(['Removed 1 image reference'])
  })
})

describe('normalizeForPreset unknown references', () => {
  it('keeps unknown references on reload until kinds load', () => {
    const seedance = getPreset('seedance-2.0')
    const ids = [
      ...Array.from({ length: 9 }, (_, i) => `i${i}`),
      ...Array.from({ length: 3 }, (_, i) => `v${i}`),
      ...Array.from({ length: 3 }, (_, i) => `a${i}`),
    ]
    const result = normalizeForPreset({
      input: input({ presetId: 'seedance-2.0', references: ids }),
      preset: seedance,
      uploads: {},
    })

    expect(result.input.references).toEqual(ids)
    expect(result.notes).toEqual([])
  })

  it('keeps all 15 mixed references once kinds are known', () => {
    const seedance = getPreset('seedance-2.0')
    const ids = [
      ...Array.from({ length: 9 }, (_, i) => `i${i}`),
      ...Array.from({ length: 3 }, (_, i) => `v${i}`),
      ...Array.from({ length: 3 }, (_, i) => `a${i}`),
    ]
    const uploads = uploadsOf(
      ...Array.from({ length: 9 }, (_, i) => upload(`i${i}`, 'image')),
      ...Array.from({ length: 3 }, (_, i) => upload(`v${i}`, 'video', { durationSec: 5 })),
      ...Array.from({ length: 3 }, (_, i) => upload(`a${i}`, 'audio', { durationSec: 3 })),
    )
    const result = normalizeForPreset({
      input: input({ presetId: 'seedance-2.0', references: ids }),
      preset: seedance,
      uploads,
    })

    expect(result.input.references).toEqual(ids)
    expect(result.notes).toEqual([])
  })
})

describe('normalizeForPreset Seedance migration', () => {
  it('normalizes a Wan draft for Seedance 2.0', () => {
    const seedance = getPreset('seedance-2.0')
    const images = Array.from({ length: 10 }, (_, i) => `i${i}`)
    const uploads = uploadsOf(
      ...images.map((id) => upload(id, 'image')),
      upload('v', 'video', { durationSec: 10 }),
      upload('a', 'audio', { durationSec: 3 }),
    )
    const result = normalizeForPreset({
      input: input({
        duration: 30,
        resolution: '768p',
        aspectRatio: '21:9',
        references: [...images, 'v', 'a'],
      }),
      preset: seedance,
      uploads,
    })

    expect(result.input.presetId).toBe('seedance-2.0')
    expect(result.input.duration).toBe(15)
    expect(result.input.resolution).toBe('720p')
    expect(result.input.aspectRatio).toBe('21:9')
    expect(result.input.references).toEqual([...images.slice(0, 9), 'v', 'a'])
    expect(result.notes).toEqual([
      'Removed 1 image reference',
      'Duration set to 15s',
      'Resolution set to 720p',
    ])
  })

  it('resets 9:21 on Seedance 2.0 away from 720p with a note', () => {
    const seedance = getPreset('seedance-2.0')
    const hd = normalizeForPreset({
      input: input({ aspectRatio: '9:21', resolution: '1080p' }),
      preset: seedance,
    })

    expect(hd.input.aspectRatio).toBe('16:9')
    expect(hd.notes).toContain('Aspect set to 16:9')
    const wide = normalizeForPreset({
      input: input({ aspectRatio: '9:21', resolution: '720p' }),
      preset: seedance,
    })

    expect(wide.input.aspectRatio).toBe('9:21')
    expect(wide.notes).not.toContain('Aspect set to 16:9')
  })

  it('is idempotent and does not mutate the draft', () => {
    const original = input({ duration: 90, references: ['i1', 'i2'] })
    const preset = withPreset({
      references: { image: 1, video: 0, audio: 0, videoTotalSec: 0, audioTotalSec: 0 },
    })
    const first = normalizeForPreset({
      input: original,
      preset,
      uploads: uploadsOf(upload('i1', 'image'), upload('i2', 'image')),
    })
    const second = normalizeForPreset({
      input: first.input,
      preset,
      uploads: uploadsOf(upload('i1', 'image'), upload('i2', 'image')),
    })

    expect(second.input).toEqual(first.input)
    expect(second.notes).toEqual([])
    expect(original.duration).toBe(90)
    expect(original.references).toEqual(['i1', 'i2'])
  })
})
