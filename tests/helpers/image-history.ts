import type {
  ImageOutput,
  ImageRecord,
  ImageRecordStatus,
} from '../../src/core/schemas/image-record'
import { type ImageGridItem, imageItems } from '../../src/lib/feed/output-items'

export const IMAGE_RECORD_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3400'
export const PLACEHOLDER_RECORD_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3401'

function savedOutput(id: string, index: number, isFavorite = false): ImageOutput {
  return {
    id,
    index,
    status: 'saved',
    file: `${id}.png`,
    mediaType: 'image/png',
    width: 1024,
    height: 768,
    bytes: 2048,
    favorite: isFavorite,
    seed: null,
  }
}

function failedOutput(id: string, index: number): ImageOutput {
  return { id, index, status: 'failed', error: 'Rejected' }
}

function pendingOutput(id: string, index: number): ImageOutput {
  return { id, index, status: 'pending' }
}

interface ImageRecordParams {
  outputs: ImageOutput[]
  id?: string
  status?: ImageRecordStatus
  prompt?: string
}

/** Image record fixture with one output per entry. */
function imageRecord(params: ImageRecordParams): ImageRecord {
  const { outputs, id = IMAGE_RECORD_ID, status = 'completed', prompt = 'a cat' } = params

  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status,
    provider: 'openrouter',
    preset: { id: 'nano-banana-2', title: 'Nano Banana', slug: 'nano-banana-2' },
    input: {
      presetId: 'nano-banana-2',
      prompt,
      count: Math.max(1, outputs.length),
      aspectRatio: '3:2',
      resolution: '1K',
      quality: null,
      background: null,
      references: [],
      seed: null,
    },
    outputs,
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

/** Completed image record with one saved output per id. */
export function imageItemsOf(outputIds: string[], isFavorite = false): ImageGridItem[] {
  return imageItems(
    imageRecord({
      outputs: outputIds.map((id, index) => {
        return savedOutput(id, index, isFavorite)
      }),
    }),
  )
}

/** Saved, failed, pending and placeholder items, all in one list. */
export function mixedImageItems(): ImageGridItem[] {
  const active = imageRecord({
    status: 'saving',
    outputs: [
      savedOutput('saved-id', 0),
      failedOutput('failed-id', 1),
      pendingOutput('pending-id', 2),
    ],
  })

  const placeholder = imageRecord({
    id: PLACEHOLDER_RECORD_ID,
    status: 'failed',
    prompt: 'placeholder',
    outputs: [],
  })

  return [...imageItems(active), ...imageItems(placeholder)]
}
