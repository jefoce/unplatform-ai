// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useHistoryPoll } from '@/features/history/list/use-history-poll'

import { HISTORY_POLL_MS } from '../src/core/constants'
import { record } from './helpers/history'

const mocks = vi.hoisted(() => {
  return {
    fetchGenerationsByIds: vi.fn(),
    refreshHistoryFeeds: vi.fn(),
  }
})

vi.mock('@/lib/api/generations', () => {
  return { fetchGenerationsByIds: mocks.fetchGenerationsByIds }
})

vi.mock('@/lib/history-feed-refresh', () => {
  return { refreshHistoryFeeds: mocks.refreshHistoryFeeds }
})

vi.mock('@/features/history/list/history-pages', () => {
  return { patchPage: vi.fn() }
})

const mutate = vi.fn(() => {
  return Promise.resolve(undefined)
})

describe('useHistoryPoll', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

    mocks.fetchGenerationsByIds.mockResolvedValue({
      items: [],
      nextCursor: null,
      activeCount: 0,
    })

    mocks.refreshHistoryFeeds.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('revalidates when no active ids are loaded so the count can reach zero', async () => {
    const { rerender } = renderHook(
      (props: { activeCount: number }) => {
        useHistoryPoll({
          activeCount: props.activeCount,
          records: [record('done')],
          mutate,
        })
      },
      { initialProps: { activeCount: 1 } },
    )

    await act(async () => {
      vi.advanceTimersByTime(HISTORY_POLL_MS * 3 - 1)
    })

    expect(mocks.fetchGenerationsByIds).not.toHaveBeenCalled()
    expect(mocks.refreshHistoryFeeds).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(1)
    })

    expect(mocks.refreshHistoryFeeds).toHaveBeenCalledTimes(1)

    // Server answer reaches the hook through SWR and clears the stuck count.
    rerender({ activeCount: 0 })

    await act(async () => {
      vi.advanceTimersByTime(HISTORY_POLL_MS * 6)
    })

    expect(mocks.fetchGenerationsByIds).not.toHaveBeenCalled()
    expect(mocks.refreshHistoryFeeds).toHaveBeenCalledTimes(1)
  })
})
