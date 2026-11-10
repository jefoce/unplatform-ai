import type { ImageOutput, ImageRecord } from '../../src/core/schemas/image-record'
import type { RecordSource } from '../../src/core/schemas/record-source'
import { type ImageGridItem, imageItems } from '../../src/lib/feed/output-items'

const RECORD_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const OUTPUT_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3302'

export const REFERENCE_ID = 'reference-one'

export function savedOutput(seed: number | null = null): ImageOutput {
  return {
    id: OUTPUT_ID,
    index: 0,
    status: 'saved',
    file: 'image-0.png',
    mediaType: 'image/png',
    width: 1024,
    height: 1024,
    bytes: 2048,
    favorite: false,
    seed,
  }
}

interface ImageRecordOverrides {
  title?: string
  presetId?: string
  prompt?: string
  resolution?: ImageRecord['input']['resolution']
  quality?: ImageRecord['input']['quality']
  background?: ImageRecord['input']['background']
  references?: string[]
  inputsSnapshot?: ImageRecord['inputsSnapshot']
  output?: ImageOutput
  estimatedUsd?: number
  actualUsd?: number | null
  source?: RecordSource
}

function actualUsdOf(overrides: ImageRecordOverrides): number | null {
  if (overrides.actualUsd === undefined) {
    return 0.2
  }

  return overrides.actualUsd
}

function referencesOf(overrides: ImageRecordOverrides): string[] {
  return overrides.references ?? []
}

function estimatedUsdOf(overrides: ImageRecordOverrides): number {
  return overrides.estimatedUsd ?? 0.2
}

function promptOf(overrides: ImageRecordOverrides): string {
  return overrides.prompt ?? 'a cat'
}

function imageRecord(overrides: ImageRecordOverrides = {}): ImageRecord {
  const createdAt = '2026-01-01T00:00:00.000Z'

  return {
    id: RECORD_ID,
    createdAt,
    updatedAt: createdAt,
    status: 'completed',
    provider: 'openrouter',
    preset: {
      id: overrides.presetId ?? 'gpt-image-2.5-sunburst',
      title: overrides.title ?? 'GPT Image 2.5 Sunburst',
      slug: overrides.presetId ?? 'gpt-image-2.5-sunburst',
    },
    input: {
      presetId: overrides.presetId ?? 'gpt-image-2.5-sunburst',
      prompt: promptOf(overrides),
      count: 1,
      aspectRatio: '1:1',
      resolution: overrides.resolution ?? null,
      quality: overrides.quality ?? 'xhigh',
      background: overrides.background ?? 'transparent',
      references: referencesOf(overrides),
      seed: null,
    },
    inputsSnapshot: overrides.inputsSnapshot,
    source: overrides.source,
    outputs: [overrides.output ?? savedOutput()],
    seedUsed: null,
    cost: {
      currency: 'USD',
      unit: 'token',
      estimatedUsd: estimatedUsdOf(overrides),
      actualUsd: actualUsdOf(overrides),
      priceSource: 'mock',
      billed: true,
    },
  }
}

export function imageItem(overrides: ImageRecordOverrides = {}): ImageGridItem {
  return imageItems(imageRecord(overrides))[0] as ImageGridItem
}

export function referenceSnapshot(name = 'cat.png'): NonNullable<ImageRecord['inputsSnapshot']> {
  return {
    [REFERENCE_ID]: { kind: 'image', originalName: name, source: 'file' },
  }
}
