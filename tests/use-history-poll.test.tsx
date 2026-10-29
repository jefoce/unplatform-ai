// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HISTORY_POLL_MS } from '@/core/constants'
import { useHistoryPoll } from '@/features/history/list/use-history-poll'

import { record } from './helpers/history'

const mocks = vi.hoisted(() => {
  return {
    fetchGenerationsByIds: vi.fn(),
    revalidateHistory: vi.fn(),
  }
})

vi.mock('@/lib/api/generations', () => {
  return { fetchGenerationsByIds: mocks.fetchGenerationsByIds }
})

vi.mock('@/features/history/list/history-pages', () => {
  return {
    patchPage: vi.fn(),
    revalidateHistory: mocks.revalidateHistory,
  }
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

    mocks.revalidateHistory.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('revalidates when no active ids are loaded so the count can reach zero', async () => {
    const { rerender } = renderHook(
      (props: { activeCount: number }) => {
        useHistoryPoll({ activeCount: props.activeCount, records: [record('done')], mutate })
      },
      { initialProps: { activeCount: 1 } },
    )

    await act(async () => {
      vi.advanceTimersByTime(HISTORY_POLL_MS * 3 - 1)
    })

    expect(mocks.fetchGenerationsByIds).not.toHaveBeenCalled()
    expect(mocks.revalidateHistory).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(1)
    })

    expect(mocks.revalidateHistory).toHaveBeenCalledTimes(1)

    // Server answer reaches the hook through SWR and clears the stuck count.
    rerender({ activeCount: 0 })

    await act(async () => {
      vi.advanceTimersByTime(HISTORY_POLL_MS * 6)
    })

    expect(mocks.fetchGenerationsByIds).not.toHaveBeenCalled()
    expect(mocks.revalidateHistory).toHaveBeenCalledTimes(1)
  })
})
