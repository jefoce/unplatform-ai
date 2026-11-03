// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useImageGeneratorStore } from '@/features/image-generator/store'
import { useImageSubmit } from '@/features/image-generator/use-image-submit'
import { refreshImages } from '@/lib/image-feed-refresh'
import { useImagePages } from '@/lib/use-image-pages'

import {
  createFeedServer,
  feedFetch,
  feedRecord,
  type ImageFeedServer,
  isPageFetch,
} from './helpers/image-feed-server'

let server: ImageFeedServer

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  return feedFetch(server)(input, init)
})

function pageFetches(): number {
  return fetchMock.mock.calls.filter(([input, init]) => {
    return isPageFetch(input, { init })
  }).length
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

beforeEach(() => {
  server = createFeedServer()
  fetchMock.mockClear()
  useImageGeneratorStore.setState({ prompt: '' })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('image feed refresh', () => {
  it('refetches page 1 of a mounted image feed', async () => {
    server.records = [feedRecord('a', false)]

    const { result } = renderHook(
      () => {
        return useImagePages({ filters: {} })
      },
      { wrapper: SwrWrapper },
    )

    await waitFor(() => {
      expect(result.current.records).toHaveLength(1)
    })

    server.records = [feedRecord('a', false), feedRecord('b', false)]

    await act(async () => {
      await refreshImages()
    })

    await waitFor(() => {
      expect(result.current.records).toHaveLength(2)
    })

    expect(pageFetches()).toBeGreaterThanOrEqual(2)
  })

  it('refetches every mounted image feed', async () => {
    server.records = [feedRecord('a', true)]

    const all = renderHook(
      () => {
        return useImagePages({ filters: {} })
      },
      { wrapper: SwrWrapper },
    )

    const liked = renderHook(
      () => {
        return useImagePages({ filters: { favorite: true } })
      },
      { wrapper: SwrWrapper },
    )

    await waitFor(() => {
      expect(all.result.current.records).toHaveLength(1)
      expect(liked.result.current.records).toHaveLength(1)
    })

    expect(pageFetches()).toBe(2)

    await act(async () => {
      await refreshImages()
    })

    await waitFor(() => {
      expect(pageFetches()).toBeGreaterThanOrEqual(4)
    })
  })
})

describe('image feed submit and poll', () => {
  it('shows the new tile after a submit without a tab switch', async () => {
    const feed = renderHook(
      () => {
        return useImagePages({ filters: {} })
      },
      { wrapper: SwrWrapper },
    )

    await waitFor(() => {
      expect(feed.result.current.isLoading).toBe(false)
    })

    const submit = renderHook(
      () => {
        return useImageSubmit({ canSubmit: true })
      },
      { wrapper: SwrWrapper },
    )

    useImageGeneratorStore.setState({ prompt: 'a cat' })

    await act(async () => {
      await submit.result.current.submit()
    })

    await waitFor(() => {
      expect(feed.result.current.records).toHaveLength(1)
    })
  })

  it('clears activeCount when the poll reports zero', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    server.records = [feedRecord('a', false, 'submitting')]
    server.activeCount = 1

    const { result } = renderHook(
      () => {
        return useImagePages({ filters: {}, refreshInterval: 1000 })
      },
      { wrapper: SwrWrapper },
    )

    await waitFor(() => {
      expect(result.current.activeCount).toBe(1)
    })

    server.records = [feedRecord('a', false)]
    server.activeCount = 0

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(result.current.activeCount).toBe(0)
    })
  })
})
