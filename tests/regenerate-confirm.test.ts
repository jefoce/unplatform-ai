import { describe, expect, it } from 'vitest'

import {
  imageRegenerateDescription,
  videoRegenerateDescription,
} from '@/features/history/actions/regenerate-confirm'

import type { GenerationRecord } from '../src/core/schemas/generation-record'
import type { RecordSource } from '../src/core/schemas/record-source'
import { imageItem } from './helpers/image-details-fixture'

const CUSTOM_SOURCE: RecordSource = {
  kind: 'custom',
  instanceId: 'ep1',
  badge: 'CU1',
  presetTitle: 'Local Wan',
  workflowName: null,
  endpointLabel: 'Studio PC',
  local: true,
}

interface RecordParams {
  presetId: string
  presetTitle: string
  resolution: GenerationRecord['input']['resolution']
  referenceSeconds: number
  estimatedUsd?: number
  source?: RecordSource
  provider?: GenerationRecord['provider']
}

function record(params: RecordParams): GenerationRecord {
  const {
    presetId,
    presetTitle,
    resolution,
    referenceSeconds,
    estimatedUsd = 0,
    source,
    provider = 'openrouter',
  } = params

  const createdAt = '2026-01-01T00:00:00.000Z'

  return {
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    createdAt,
    updatedAt: createdAt,
    status: 'completed',
    provider,
    source,
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
      estimatedUsd,
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

describe('custom regenerate estimate', () => {
  it('shows the stored per-run estimate without quoting the endpoint', () => {
    const text = videoRegenerateDescription(
      record({
        presetId: 'custom.ep1.wan22',
        presetTitle: 'Local Wan',
        resolution: '1080p',
        referenceSeconds: 10,
        estimatedUsd: 2.5,
        source: CUSTOM_SOURCE,
        provider: 'custom',
      }),
    )

    expect(text).toBe('Regenerate this video for ~$2.50?')
  })

  it('shows the stored per-second total estimate', () => {
    const text = videoRegenerateDescription(
      record({
        presetId: 'custom.ep1.wan22',
        presetTitle: 'Local Wan',
        resolution: '1080p',
        referenceSeconds: 10,
        estimatedUsd: 0.4,
        source: CUSTOM_SOURCE,
        provider: 'custom',
      }),
    )

    expect(text).toBe('Regenerate this video for ~$0.40?')
  })

  it('hides the price for a free local run', () => {
    const text = videoRegenerateDescription(
      record({
        presetId: 'custom.ep1.wan22',
        presetTitle: 'Local Wan',
        resolution: '1080p',
        referenceSeconds: 10,
        source: CUSTOM_SOURCE,
        provider: 'custom',
      }),
    )

    expect(text).toBe('Regenerate this video?')
  })

  it('still quotes an API record and ignores its stored estimate', () => {
    const text = videoRegenerateDescription(
      record({
        presetId: 'wan-3.0',
        presetTitle: 'Wan 3.0',
        resolution: '1080p',
        referenceSeconds: 10,
        estimatedUsd: 99,
      }),
    )

    expect(text).toBe('Regenerate this video for ~$3.00?')
  })

  it('shows the stored estimate for an image record', () => {
    const item = imageItem({
      source: { ...CUSTOM_SOURCE, presetTitle: 'Local Image' },
      estimatedUsd: 2.5,
    })

    expect(imageRegenerateDescription(item)).toBe('Regenerate 1 image for ~$2.50?')
  })

  it('hides the price for a free local image run', () => {
    const item = imageItem({
      source: { ...CUSTOM_SOURCE, presetTitle: 'Local Image' },
      estimatedUsd: 0,
    })

    expect(imageRegenerateDescription(item)).toBe('Regenerate 1 image?')
  })
})
