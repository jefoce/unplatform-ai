import { describe, expect, it } from 'vitest'

import { maxDurationFor } from '@/core/duration-limits'
import { getPreset, minDuration } from '@/core/presets'
import { issueText } from '@/core/validation'

import { input, preset, upload, uploadsOf } from './helpers/validation-fixtures'

describe('maxDurationFor', () => {
  it('returns the preset max on the frames tab', () => {
    expect(
      maxDurationFor({
        input: input({ tab: 'frames', references: ['v'] }),
        uploads: uploadsOf(upload('v', 'video', { durationSec: 20 })),
        preset,
      }),
    ).toBe(preset.duration.max)
  })

  it('returns the preset max without a video reference', () => {
    expect(
      maxDurationFor({
        input: input({ references: ['i'] }),
        uploads: uploadsOf(upload('i', 'image')),
        preset,
      }),
    ).toBe(preset.duration.max)
  })

  it('subtracts the total video duration and floors, clamped to the preset range', () => {
    expect(
      maxDurationFor({
        input: input({ references: ['v1'] }),
        uploads: uploadsOf(upload('v1', 'video', { durationSec: 6.8 })),
        preset,
      }),
    ).toBe(23)

    const uploads = uploadsOf(
      upload('v1', 'video', { durationSec: 6.8 }),
      upload('v2', 'video', { durationSec: 3 }),
    )

    expect(maxDurationFor({ input: input({ references: ['v1', 'v2'] }), uploads, preset })).toBe(20)

    expect(
      maxDurationFor({
        input: input({ references: ['v1'] }),
        uploads: uploadsOf(upload('v1', 'video', { durationSec: 60 })),
        preset,
      }),
    ).toBe(minDuration(preset))
  })

  it('caps two 7s reference videos at 16s', () => {
    const uploads = uploadsOf(
      upload('v1', 'video', { durationSec: 7 }),
      upload('v2', 'video', { durationSec: 7 }),
    )

    expect(maxDurationFor({ input: input({ references: ['v1', 'v2'] }), uploads, preset })).toBe(16)
  })

  it('returns the preset max when the combined rule is off', () => {
    const seedance = getPreset('seedance-2.0')

    expect(
      maxDurationFor({
        input: input({ presetId: 'seedance-2.0', references: ['v'] }),
        uploads: uploadsOf(upload('v', 'video', { durationSec: 10 })),
        preset: seedance,
      }),
    ).toBe(seedance.duration.max)
  })

  it('returns the exact numeric limit without snapping to a preset option', () => {
    const optionPreset = {
      ...preset,
      duration: { min: 4, max: 8, default: 6, options: [4, 6, 8] as const },
    }

    const uploads = uploadsOf(upload('v', 'video', { durationSec: 25 }))

    expect(
      maxDurationFor({ input: input({ references: ['v'] }), uploads, preset: optionPreset }),
    ).toBe(5)

    expect(
      maxDurationFor({ input: input({ tab: 'frames' }), uploads: {}, preset: optionPreset }),
    ).toBe(8)
  })
})

describe('issueText', () => {
  it('formats each missing-slot kind exactly', () => {
    expect(issueText({ type: 'missing-slot', slot: { kind: 'image', n: 3 }, attached: 2 })).toBe(
      '@Image 3 is not attached (2 images)',
    )

    expect(issueText({ type: 'missing-slot', slot: { kind: 'video', n: 1 }, attached: 0 })).toBe(
      '@Video 1 is not attached (0 videos)',
    )

    expect(issueText({ type: 'missing-slot', slot: { kind: 'audio', n: 2 }, attached: 1 })).toBe(
      '@Audio 2 is not attached (1 audio)',
    )
  })

  it('passes text warnings through unchanged', () => {
    expect(issueText({ type: 'text', text: 'Low resolution input, output may look soft' })).toBe(
      'Low resolution input, output may look soft',
    )
  })
})
