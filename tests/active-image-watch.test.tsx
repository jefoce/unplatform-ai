// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ImageListResult } from '@/core/api/image'
import type { GenerationListResult } from '@/core/api/video'
import { HISTORY_POLL_MS } from '@/core/constants'
import type { ImageRecord, ImageRecordStatus } from '@/core/schemas/image-record'
import { setWorkspaceTab } from '@/features/shared/use-workspace-tab'
import { JobWatcher } from '@/features/studio/JobWatcher'
import type * as GenerationsModule from '@/lib/api/generations'
import type * as ImagesModule from '@/lib/api/images'

const mocks = vi.hoisted(() => {
  return { fetchGenerationPage: vi.fn(), fetchImagePage: vi.fn(), fetchActiveImages: vi.fn() }
})

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

vi.mock('@/lib/api/generations', async (importOriginal) => {
  const actual = await importOriginal<typeof GenerationsModule>()

  return { ...actual, fetchGenerationPage: mocks.fetchGenerationPage }
})

vi.mock('@/lib/api/images', async (importOriginal) => {
  const actual = await importOriginal<typeof ImagesModule>()

  return {
    ...actual,
    fetchImagePage: mocks.fetchImagePage,
    fetchActiveImages: mocks.fetchActiveImages,
  }
})

const IMAGE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const EMPTY_GENERATIONS: GenerationListResult = { items: [], nextCursor: null, activeCount: 0 }

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

function result(items: ImageRecord[]): ImageListResult {
  return { items, nextCursor: null, activeCount: items.length }
}

function SwrWrapper(props: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        provider: () => {
          return new Map()
        },
        dedupingInterval: 0,
      }}
    >
      {props.children}
    </SWRConfig>
  )
}

async function flush(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  window.history.replaceState(null, '', '/?tab=image')
  document.title = 'Unplatform AI'
  mocks.fetchGenerationPage.mockReset()
  mocks.fetchImagePage.mockReset()
  mocks.fetchActiveImages.mockReset()
  toast.success.mockReset()
  toast.error.mockReset()
  notify.mockReset()
  mocks.fetchGenerationPage.mockResolvedValue(EMPTY_GENERATIONS)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  window.history.replaceState(null, '', '/')
})

describe('active image watch away from the image tab', () => {
  it('toasts and titles an image that finishes while the video tab hides the feed', async () => {
    const active = image('submitting')
    const done = image('completed')

    mocks.fetchActiveImages.mockResolvedValue(result([active]))

    render(
      <JobWatcher imageRecords={[active]}>
        <span />
      </JobWatcher>,
      { wrapper: SwrWrapper },
    )

    await flush()

    expect(document.title).toBe('(1) Generating \u00b7 Unplatform AI')

    act(() => {
      setWorkspaceTab('video')
    })

    await flush()

    expect(mocks.fetchActiveImages).toHaveBeenCalled()
    expect(document.title).toBe('(1) Generating \u00b7 Unplatform AI')

    mocks.fetchImagePage.mockResolvedValue(result([done]))
    mocks.fetchActiveImages.mockResolvedValue(result([]))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(HISTORY_POLL_MS)
    })

    await flush()

    expect(toast.success).toHaveBeenCalledWith(
      'Nano Banana',
      expect.objectContaining({ description: 'a cat' }),
    )

    expect(document.title).toBe('Unplatform AI')
  })

  it('fetches the final record by ids when it leaves the active set', async () => {
    const active = image('submitting')

    mocks.fetchImagePage.mockResolvedValue(result([active]))
    mocks.fetchActiveImages.mockResolvedValue(result([active]))

    render(
      <JobWatcher imageRecords={[active]}>
        <span />
      </JobWatcher>,
      { wrapper: SwrWrapper },
    )

    await flush()

    act(() => {
      setWorkspaceTab('video')
    })

    await flush()

    mocks.fetchActiveImages.mockResolvedValue(result([]))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(HISTORY_POLL_MS)
    })

    await flush()

    expect(mocks.fetchImagePage).toHaveBeenCalledWith(expect.stringContaining(`ids=${IMAGE_ID}`))
  })
})
