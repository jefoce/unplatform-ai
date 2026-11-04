import { describe, expect, it } from 'vitest'

import { videoRegenerateDescription } from '@/features/history/actions/regenerate-confirm'

import type { GenerationRecord } from '../src/core/schemas/generation-record'

interface RecordParams {
  presetId: string
  presetTitle: string
  resolution: GenerationRecord['input']['resolution']
  referenceSeconds: number
}

function record(params: RecordParams): GenerationRecord {
  const { presetId, presetTitle, resolution, referenceSeconds } = params
  const createdAt = '2026-01-01T00:00:00.000Z'

  return {
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    createdAt,
    updatedAt: createdAt,
    status: 'completed',
    provider: 'openrouter',
    input: {
      presetId,
      tab: 'references',
      prompt: 'a cat',
      audio: true,
      duration: 5,
      aspectRatio: '16:9',
      resolution,
      frames: { start: null, end: null },
      references: ['3f2504e0-4f89-41d3-9a0c-0305e82c3302'],
      seed: null,
    },
    preset: { id: presetId, title: presetTitle, slug: presetId },
    inputsSnapshot: {
      '3f2504e0-4f89-41d3-9a0c-0305e82c3302': {
        kind: 'video',
        originalName: 'ref.mp4',
        source: 'file',
      },
    },
    seedUsed: null,
    favorite: false,
    cost: {
      currency: 'USD',
      pricePerSec: 0,
      priceSource: 'mock',
      estimatedUsd: 0,
      actualUsd: null,
      referenceSeconds,
      isByok: false,
      billed: null,
    },
  }
}

describe('video regenerate quote', () => {
  it('bills the persisted Wan reference seconds', () => {
    const text = videoRegenerateDescription(
      record({
        presetId: 'wan-3.0',
        presetTitle: 'Wan 3.0',
        resolution: '1080p',
        referenceSeconds: 10,
      }),
    )

    expect(text).toBe('Regenerate this video for ~$3.00?')
  })

  it('bills the persisted Seedance reference seconds', () => {
    const text = videoRegenerateDescription(
      record({
        presetId: 'seedance-2.0',
        presetTitle: 'Seedance 2.0',
        resolution: '720p',
        referenceSeconds: 3,
      }),
    )

    expect(text).toBe('Regenerate this video for ~$0.74?')
  })

  it('falls back to zero seconds on a record from before the field existed', () => {
    const source = record({
      presetId: 'wan-3.0',
      presetTitle: 'Wan 3.0',
      resolution: '1080p',
      referenceSeconds: 0,
    })

    expect(videoRegenerateDescription(source)).toBe('Regenerate this video for ~$1.00?')
  })
})
