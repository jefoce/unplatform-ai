import { describe, expect, it } from 'vitest'

import { imageCostInfo } from '@/features/history/details/details-info'

import type { ImageRecord } from '../src/core/schemas/image-record'
import { imageItems } from '../src/lib/feed/output-items'
import { required } from './helpers/required'

const RECORD_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const OUTPUT_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3302'

interface RecordOverrides {
  status?: ImageRecord['status']
  actualUsd?: number | null
  count?: number
  mayHaveBeenCharged?: boolean
}

function record(overrides: RecordOverrides = {}): ImageRecord {
  const createdAt = '2026-01-01T00:00:00.000Z'
  const count = overrides.count ?? 1

  return {
    id: RECORD_ID,
    createdAt,
    updatedAt: createdAt,
    status: overrides.status ?? 'completed',
    provider: 'openrouter',
    preset: { id: 'gpt-image-2.5-sunburst', title: 'GPT Image 2.5 Sunburst', slug: 'sunburst' },
    input: {
      presetId: 'gpt-image-2.5-sunburst',
      prompt: 'a cat',
      count,
      aspectRatio: '1:1',
      resolution: null,
      quality: 'high',
      background: 'auto',
      references: [],
      seed: null,
    },
    outputs: Array.from({ length: count }, (_, index) => {
      return {
        id: index === 0 ? OUTPUT_ID : `3f2504e0-4f89-41d3-9a0c-0305e82c33${index + 1}`,
        index,
        status: 'saved' as const,
        file: `a-${index}.png`,
        mediaType: 'image/png' as const,
        width: 1,
        height: 1,
        bytes: 1,
        favorite: false,
        seed: null,
      }
    }),
    seedUsed: null,
    cost: {
      currency: 'USD',
      unit: 'token',
      estimatedUsd: 0.2,
      actualUsd: overrides.actualUsd === undefined ? 0.2 : overrides.actualUsd,
      priceSource: 'mock',
      billed: null,
      mayHaveBeenCharged: overrides.mayHaveBeenCharged,
    },
  }
}

function info(overrides: RecordOverrides = {}) {
  const [item] = imageItems(record(overrides))

  return imageCostInfo(required(item, 'image item'))
}

describe('image cost info', () => {
  it('shows the actual cost when it is reported', () => {
    expect(info({ actualUsd: 0.2 })).toEqual({ text: '$0.20', note: '' })
  })

  it('marks an unreported cost as an estimate', () => {
    expect(info({ actualUsd: null })).toEqual({ text: '≈ $0.20', note: 'Cost not reported' })
  })

  it('shows the estimate while the record is active', () => {
    expect(info({ status: 'saving', actualUsd: null })).toEqual({ text: '≈ $0.20', note: '' })
  })

  it('shows Not billed for a failed record', () => {
    expect(info({ status: 'failed', actualUsd: null })).toEqual({ text: 'Not billed', note: '' })
  })

  it('shows the real cost of a failed record that was billed', () => {
    expect(info({ status: 'failed', actualUsd: 0.04 })).toEqual({ text: '$0.04', note: '' })
  })

  it('divides the real cost of a failed record across its saved outputs', () => {
    expect(info({ status: 'failed', actualUsd: 0.04, count: 2 })).toEqual({
      text: '$0.02 each',
      note: '',
    })
  })

  it('flags an uncertain call that may have been charged', () => {
    expect(info({ status: 'failed', actualUsd: null, mayHaveBeenCharged: true })).toEqual({
      text: '≈ $0.20',
      note: 'Cost not reported. May have been charged',
    })
  })

  it('warns next to a partial actual cost', () => {
    expect(info({ status: 'partial', actualUsd: 0.2, mayHaveBeenCharged: true })).toEqual({
      text: '$0.20',
      note: 'May have been charged',
    })
  })

  it('labels a per-image price as each', () => {
    const [item] = imageItems(record({ actualUsd: 0.2, count: 2 }))

    expect(imageCostInfo(required(item, 'image item')).text).toBe('$0.10 each')
  })
})
