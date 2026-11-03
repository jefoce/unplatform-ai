// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenerationRecord } from '../src/core/schemas/generation-record'
import type { ImageRecord, ImageRecordStatus } from '../src/core/schemas/image-record'
import { storedRecord } from './helpers/stored-record'

const toast = vi.hoisted(() => {
  return { success: vi.fn(), error: vi.fn() }
})

const notify = vi.hoisted(() => {
  return vi.fn()
})

vi.mock('sonner', () => {
  return { toast }
})

vi.mock('@/lib/platform', () => {
  return {
    getPlatform: async () => {
      return { notify }
    },
  }
})

const { notifyFailure, useJobNotifications } =
  await import('@/features/history/status/use-job-notifications')

const VIDEO_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const IMAGE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

function video(status: GenerationRecord['status']): GenerationRecord {
  return storedRecord(VIDEO_ID, { status })
}

function image(status: ImageRecordStatus): ImageRecord {
  return {
    id: IMAGE_ID,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status,
    provider: 'openrouter',
    preset: { id: 'nano-banana-2', title: 'Nano Banana', slug: 'nano-banana-2' },
    input: {
      presetId: 'nano-banana-2',
      prompt: 'a cat',
      count: 1,
      aspectRatio: 'auto',
      resolution: null,
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
      estimatedUsd: 0,
      actualUsd: null,
      priceSource: 'mock',
      billed: null,
    },
  }
}

interface NotificationProps {
  records: GenerationRecord[]
  imageRecords: ImageRecord[]
  activeCount: number
  isLoading: boolean
}

function renderNotifications(initialProps: NotificationProps) {
  return renderHook(
    (props: NotificationProps) => {
      useJobNotifications(props)
    },
    { initialProps },
  )
}

beforeEach(() => {
  window.history.replaceState(null, '', '/?tab=image')
  document.title = 'Unplatform AI'
  toast.success.mockReset()
  toast.error.mockReset()
  notify.mockReset()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('job notifications away from the video tab', () => {
  it('toasts and titles a video that finishes while the image tab is open', async () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')

    const { rerender } = renderNotifications({
      records: [video('in_progress')],
      imageRecords: [],
      activeCount: 1,
      isLoading: false,
    })

    expect(document.title).toBe('(1) Generating \u00b7 Unplatform AI')

    rerender({
      records: [video('completed')],
      imageRecords: [],
      activeCount: 0,
      isLoading: false,
    })

    await act(async () => {})

    expect(toast.success).toHaveBeenCalledWith(
      'Video ready',
      expect.objectContaining({ description: 'A cat' }),
    )

    expect(notify).toHaveBeenCalledWith('Video ready', 'A cat')
    expect(document.title).toBe('Unplatform AI')
  })

  it('toasts an image that finishes during a watch', async () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')

    const { rerender } = renderNotifications({
      records: [],
      imageRecords: [image('saving')],
      activeCount: 1,
      isLoading: false,
    })

    rerender({
      records: [],
      imageRecords: [image('completed')],
      activeCount: 0,
      isLoading: false,
    })

    await act(async () => {})

    expect(toast.success).toHaveBeenCalledWith(
      'Image ready',
      expect.objectContaining({ description: 'a cat' }),
    )

    expect(notify).toHaveBeenCalledWith('Image ready', 'a cat')
  })

  it('toasts an image that is cancelled during a watch', async () => {
    const { rerender } = renderNotifications({
      records: [],
      imageRecords: [image('saving')],
      activeCount: 1,
      isLoading: false,
    })

    rerender({
      records: [],
      imageRecords: [image('cancelled')],
      activeCount: 0,
      isLoading: false,
    })

    await act(async () => {})

    expect(toast.error).toHaveBeenCalledWith(
      'Image cancelled',
      expect.objectContaining({ description: 'a cat' }),
    )
  })

  it('toasts an image that expires', () => {
    notifyFailure({ kind: 'image', status: 'expired', description: 'a cat' })

    expect(toast.error).toHaveBeenCalledWith('Image expired', { description: 'a cat' })
  })
})
