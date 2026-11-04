// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenerationListResult } from '@/core/api/video'
import type * as GenerationsModule from '@/lib/api/generations'
import { useGenerationPages } from '@/lib/use-generation-pages'

import { record } from './helpers/history'

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
})

afterEach(() => {
  cleanup()
})

describe('video picker pages', () => {
  it('renders a duplicate id across cursor pages once', async () => {
    const first: GenerationListResult = {
      items: [record('a')],
      nextCursor: 'cursor-1',
      activeCount: 0,
    }

    const second: GenerationListResult = {
      items: [record('a'), record('b')],
      nextCursor: null,
      activeCount: 0,
    }

    mocks.fetchGenerationPage.mockImplementation((key: string) => {
      if (String(key).includes('cursor=')) {
        return Promise.resolve(second)
      }

      return Promise.resolve(first)
    })

    const { result } = renderHook(
      () => {
        return useGenerationPages({ isFavorite: false })
      },
      { wrapper: SwrWrapper },
    )

    await waitFor(() => {
      expect(result.current.records).toHaveLength(1)
    })

    act(() => {
      result.current.loadMore()
    })

    await waitFor(() => {
      expect(result.current.records).toHaveLength(2)
    })

    expect(
      result.current.records.map((item) => {
        return item.id
      }),
    ).toEqual(['a', 'b'])
  })

  it('does not refetch on window focus', async () => {
    mocks.fetchGenerationPage.mockResolvedValue({
      items: [record('a')],
      nextCursor: null,
      activeCount: 0,
    } satisfies GenerationListResult)

    const { result } = renderHook(
      () => {
        return useGenerationPages({ isFavorite: false })
      },
      { wrapper: SwrWrapper },
    )

    await waitFor(() => {
      expect(result.current.records).toHaveLength(1)
    })

    const calls = mocks.fetchGenerationPage.mock.calls.length

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    expect(mocks.fetchGenerationPage).toHaveBeenCalledTimes(calls)
  })

  it('stays paused while the caller keeps it parked', async () => {
    renderHook(
      () => {
        return useGenerationPages({ isFavorite: false, isPaused: true })
      },
      { wrapper: SwrWrapper },
    )

    await act(async () => {})

    expect(mocks.fetchGenerationPage).not.toHaveBeenCalled()
  })
})
