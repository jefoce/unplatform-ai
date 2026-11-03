import { describe, expect, it } from 'vitest'

import { imageStatusView } from '@/features/history/status/status-view'

import type { ImageRecord } from '../src/core/schemas/image-record'
import { imageItems } from '../src/lib/feed/output-items'
import { required } from './helpers/required'

function failedRecord(): ImageRecord {
  return {
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3400',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'partial',
    provider: 'openrouter',
    preset: { id: 'gemini-3.1-flash-image', title: 'Nano Banana', slug: 'gemini' },
    input: {
      presetId: 'gemini-3.1-flash-image',
      prompt: 'a cat',
      count: 1,
      aspectRatio: '1:1',
      resolution: '1K',
      quality: null,
      background: null,
      references: [],
      seed: null,
    },
    outputs: [
      {
        id: '3f2504e0-4f89-41d3-9a0c-0305e82c3401',
        index: 0,
        status: 'failed',
        error: 'raw',
        errorStatus: 402,
      },
    ],
    seedUsed: null,
    cost: {
      currency: 'USD',
      unit: 'image',
      estimatedUsd: 0,
      actualUsd: null,
      priceSource: 'unknown',
      billed: null,
    },
    error: 'record raw',
    errorStatus: 429,
  }
}

describe('image output error status', () => {
  it('translates a failed output with its own HTTP status', () => {
    const [item] = imageItems(failedRecord())
    const view = imageStatusView(required(item, 'image item'))

    expect(view.error?.title).toBe('Not enough OpenRouter credits.')
  })
})
