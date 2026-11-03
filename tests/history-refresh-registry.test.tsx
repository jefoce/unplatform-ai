// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenerationListResult } from '@/core/api/video'
import { useHistory } from '@/features/history/list/use-history'
import type * as GenerationsModule from '@/lib/api/generations'
import { refreshHistoryFeeds } from '@/lib/history-feed-refresh'

const mocks = vi.hoisted(() => {
  return { fetchGenerationPage: vi.fn() }
})

vi.mock('@/lib/api/generations', async (importOriginal) => {
  const actual = await importOriginal<typeof GenerationsModule>()

  return { ...actual, fetchGenerationPage: mocks.fetchGenerationPage }
})

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

beforeEach(() => {
  mocks.fetchGenerationPage.mockReset()

  mocks.fetchGenerationPage.mockResolvedValue({
    items: [],
    nextCursor: null,
    activeCount: 0,
  } satisfies GenerationListResult)
})

afterEach(() => {
  cleanup()
})

describe('history refresh registry', () => {
  it('refreshes both mounted history feeds', async () => {
    renderHook(
      () => {
        return useHistory()
      },
      { wrapper: SwrWrapper },
    )

    renderHook(
      () => {
        return useHistory()
      },
      { wrapper: SwrWrapper },
    )

    await waitFor(() => {
      expect(mocks.fetchGenerationPage).toHaveBeenCalledTimes(2)
    })

    await act(async () => {
      await refreshHistoryFeeds()
    })

    await waitFor(() => {
      expect(mocks.fetchGenerationPage).toHaveBeenCalledTimes(4)
    })
  })
})
