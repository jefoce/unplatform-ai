// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CREDITS_SETTLE_MS } from '@/core/constants'
import { useGenerate } from '@/features/generator/generate/use-generate'
import { useGeneratorStore } from '@/features/generator/store/store'
import { useJobNotifications } from '@/features/history/status/use-job-notifications'
import { useImageGeneratorStore } from '@/features/image-generator/store'
import { useImageSubmit } from '@/features/image-generator/use-image-submit'

import type { GenerationRecord } from '../src/core/schemas/generation-record'
import type { ImageRecord } from '../src/core/schemas/image-record'
import { record } from './helpers/history'
import { storedRecord } from './helpers/stored-record'

const mocks = vi.hoisted(() => {
  return {
    createGeneration: vi.fn(),
    createImage: vi.fn(),
    refreshHistoryFeeds: vi.fn(async () => {}),
    refreshImages: vi.fn(async () => {}),
    notify: vi.fn(),
    requestNotifications: vi.fn(),
  }
})

vi.mock('@/lib/platform', () => {
  return {
    getPlatform: async () => {
      return {
        notify: mocks.notify,
        requestNotifications: mocks.requestNotifications,
      }
    },
  }
})

vi.mock('@/lib/api/generations', () => {
  return { createGeneration: mocks.createGeneration }
})

vi.mock('@/lib/api/images', () => {
  return { createImage: mocks.createImage }
})

vi.mock('@/lib/history-feed-refresh', () => {
  return { refreshHistoryFeeds: mocks.refreshHistoryFeeds }
})

vi.mock('@/lib/image-feed-refresh', () => {
  return { refreshImages: mocks.refreshImages }
})

vi.mock('sonner', () => {
  return { toast: { success: vi.fn(), error: vi.fn() } }
})

const fetchMock = vi.fn((_url: string) => {
  return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
})

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
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockClear()
  mocks.createGeneration.mockResolvedValue(record('generated'))
  mocks.createImage.mockResolvedValue({})
  useGeneratorStore.getState().reset()
  useGeneratorStore.setState({ prompts: { frames: 'a cat', references: '' } })
  useImageGeneratorStore.setState({ prompt: 'a cat' })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('credits refresh after submit', () => {
  it('requests fresh credits after a video submit', async () => {
    const { result } = renderHook(() => {
      return useGenerate({ canSubmit: true })
    })

    await act(async () => {
      await result.current.generate()
    })

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/credits?fresh=1')
  })

  it('requests fresh credits after an image submit', async () => {
    const { result } = renderHook(() => {
      return useImageSubmit({ canSubmit: true })
    })

    await act(async () => {
      await result.current.submit()
    })

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/credits?fresh=1')
  })
})

describe('credits refresh after a job finishes', () => {
  it('refreshes once on completion and again after the settle delay', async () => {
    vi.useFakeTimers()

    const { rerender } = renderNotifications({
      records: [storedRecord('video-1', { status: 'in_progress' })],
      imageRecords: [],
      activeCount: 1,
      isLoading: false,
    })

    await act(async () => {})

    rerender({
      records: [storedRecord('video-1', { status: 'completed' })],
      imageRecords: [],
      activeCount: 0,
      isLoading: false,
    })

    await act(async () => {})

    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(CREDITS_SETTLE_MS - 1)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(1)
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('refreshes once when several records finish in the same tick', async () => {
    const ids = ['video-1', 'video-2', 'video-3']

    const { rerender } = renderNotifications({
      records: ids.map((id) => {
        return storedRecord(id, { status: 'in_progress' })
      }),
      imageRecords: [],
      activeCount: 3,
      isLoading: false,
    })

    await act(async () => {})

    rerender({
      records: ids.map((id) => {
        return storedRecord(id, { status: 'completed' })
      }),
      imageRecords: [],
      activeCount: 0,
      isLoading: false,
    })

    await act(async () => {})

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
