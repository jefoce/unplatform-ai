// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { regenerateItem } from '@/features/history/actions/regenerate-actions'

import type { ImageRecord } from '../src/core/schemas/image-record'
import { imageItems } from '../src/lib/feed/output-items'
import { required } from './helpers/required'

const mocks = vi.hoisted(() => {
  return {
    createImage: vi.fn(),
    refreshImages: vi.fn(),
  }
})

vi.mock('@/lib/api/images', () => {
  return { createImage: mocks.createImage }
})

vi.mock('@/lib/image-feed-refresh', () => {
  return { refreshImages: mocks.refreshImages }
})

vi.mock('@/lib/api/credits', () => {
  return {
    refreshCredits: () => {
      return Promise.resolve()
    },
  }
})

vi.mock('@/lib/notify', () => {
  return { toastError: vi.fn() }
})

vi.mock('sonner', () => {
  return { toast: { success: vi.fn(), error: vi.fn() } }
})

vi.mock('@/features/generator/media-actions', () => {
  return { applyImageOutputReference: vi.fn() }
})

vi.mock('@/features/shared/use-workspace-tab', () => {
  return { setWorkspaceTab: vi.fn() }
})

const RECORD_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const OUTPUT_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3302'

function failedRecord(): ImageRecord {
  const createdAt = '2026-01-01T00:00:00.000Z'

  return {
    id: RECORD_ID,
    createdAt,
    updatedAt: createdAt,
    status: 'failed',
    provider: 'openrouter',
    preset: { id: 'gpt-image-2.5-sunburst', title: 'GPT Image 2.5 Sunburst', slug: 'sunburst' },
    input: {
      presetId: 'gpt-image-2.5-sunburst',
      prompt: 'a cat',
      count: 1,
      aspectRatio: '1:1',
      resolution: null,
      quality: 'high',
      background: 'auto',
      references: [],
      seed: 123,
    },
    outputs: [{ id: OUTPUT_ID, index: 0, status: 'failed', error: 'No' }],
    seedUsed: 123,
    cost: {
      currency: 'USD',
      unit: 'token',
      estimatedUsd: 0.2,
      actualUsd: null,
      priceSource: 'mock',
      billed: null,
    },
  }
}

beforeEach(() => {
  mocks.createImage.mockReset()
  mocks.refreshImages.mockReset()
})

function seedRecord(isSeedLocked: boolean): ImageRecord {
  return {
    ...failedRecord(),
    seedLocked: isSeedLocked,
    input: { ...failedRecord().input, seed: 123 },
  }
}

describe('regenerateItem', () => {
  it('refreshes image keys after the new request resolves', async () => {
    let resolveCreate: ((record: ImageRecord) => void) | undefined

    mocks.createImage.mockImplementation(() => {
      return new Promise<ImageRecord>((resolve) => {
        resolveCreate = resolve
      })
    })

    mocks.refreshImages.mockResolvedValue(undefined)

    const item = required(imageItems(failedRecord())[0], 'failed image item')
    const pending = regenerateItem(item)

    expect(mocks.createImage).toHaveBeenCalledWith(item.source.input)
    expect(mocks.refreshImages).not.toHaveBeenCalled()

    required(resolveCreate, 'create resolver')(failedRecord())
    await pending

    expect(mocks.refreshImages).toHaveBeenCalledTimes(1)

    expect(required(mocks.createImage.mock.invocationCallOrder[0], 'create order')).toBeLessThan(
      required(mocks.refreshImages.mock.invocationCallOrder[0], 'refresh order'),
    )
  })

  it('reuses the requested seed when it is locked', async () => {
    mocks.createImage.mockResolvedValue(failedRecord())
    mocks.refreshImages.mockResolvedValue(undefined)

    const item = required(imageItems(seedRecord(true))[0], 'locked image item')

    await regenerateItem(item)

    expect(mocks.createImage).toHaveBeenCalledWith(expect.objectContaining({ seed: 123 }))
  })

  it('draws a new seed when it is unlocked', async () => {
    mocks.createImage.mockResolvedValue(failedRecord())
    mocks.refreshImages.mockResolvedValue(undefined)

    const item = required(imageItems(seedRecord(false))[0], 'unlocked image item')

    await regenerateItem(item)

    expect(mocks.createImage).toHaveBeenCalledWith(expect.objectContaining({ seed: null }))
  })
})
