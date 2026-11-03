import { describe, expect, it } from 'vitest'

import { imagePollInterval } from '@/features/workspace/use-image-workspace-items'

import type { ImageListResult } from '../src/core/api/image'
import { HISTORY_POLL_MS } from '../src/core/constants'
import type { ImageRecord, ImageRecordStatus } from '../src/core/schemas/image-record'

const RECORD_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

function imageRecord(status: ImageRecordStatus): ImageRecord {
  return {
    id: RECORD_ID,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status,
    provider: 'openrouter',
    preset: { id: 'nano-banana-2', title: 'Nano Banana', slug: 'nano-banana-2' },
    input: {
      presetId: 'nano-banana-2',
      prompt: 'a cat',
      count: 1,
      aspectRatio: '1:1',
      resolution: '1K',
      quality: null,
      background: null,
      references: [],
      seed: null,
    },
    outputs: [],
    seedUsed: null,
    cost: {
      currency: 'USD',
      unit: 'image',
      estimatedUsd: 0.02,
      actualUsd: 0.02,
      priceSource: 'mock',
      billed: true,
    },
  }
}

function page(status: ImageRecordStatus): ImageListResult {
  const isActive = status === 'submitting' || status === 'saving'

  return { items: [imageRecord(status)], nextCursor: null, activeCount: isActive ? 1 : 0 }
}

describe('imagePollInterval', () => {
  it('polls once a revalidated page holds a submitting record', () => {
    expect(imagePollInterval(undefined)).toBe(0)
    expect(imagePollInterval([page('completed')])).toBe(0)
    expect(imagePollInterval([page('submitting')])).toBe(HISTORY_POLL_MS)
    expect(imagePollInterval([page('completed'), page('saving')])).toBe(HISTORY_POLL_MS)
  })

  it('polls a filtered page whose first page reports active work', () => {
    const filtered: ImageListResult = {
      items: [imageRecord('completed')],
      nextCursor: null,
      activeCount: 2,
    }

    expect(imagePollInterval([filtered])).toBe(HISTORY_POLL_MS)
  })
})
