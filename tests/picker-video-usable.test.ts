import { describe, expect, it } from 'vitest'

import type { GenerationRecord } from '../src/core/schemas/generation-record'
import { videoItems } from '../src/lib/feed/picker-items'

function record(
  id: string,
  status: GenerationRecord['status'],
  hasOutput = true,
): GenerationRecord {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status,
    provider: 'openrouter',
    preset: { id: 'fixture', title: 'Fixture', slug: 'fixture' },
    input: {
      presetId: 'fixture',
      tab: 'references',
      prompt: 'a dog',
      audio: false,
      duration: 4,
      aspectRatio: '16:9',
      resolution: '720p',
      frames: { start: null, end: null },
      references: [],
      seed: null,
    },
    inputsSnapshot: {},
    seedUsed: null,
    favorite: false,
    cost: {
      currency: 'USD',
      pricePerSec: 0,
      priceSource: 'unknown',
      estimatedUsd: 0,
      actualUsd: null,
      isByok: false,
      billed: null,
    },
    output: hasOutput ? { video: 'video.mp4', preview: 'video.png' } : undefined,
  }
}

describe('picker video items', () => {
  it('lists only completed records with a downloaded file', () => {
    const items = videoItems([
      record('done', 'completed'),
      record('running', 'in_progress'),
      record('missing', 'completed', false),
    ])

    expect(
      items.map((item) => {
        return item.id
      }),
    ).toEqual(['done'])
  })
})
