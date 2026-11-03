// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ImageListResult } from '@/core/api/image'
import type { ImageRecord } from '@/core/schemas/image-record'
import { favoriteImageItem } from '@/features/history/actions/image-actions'
import { currentFavoriteEpoch } from '@/lib/favorite-epoch'
import { imageItems } from '@/lib/feed/output-items'
import { patchImagePages } from '@/lib/image-page-patch'
import { useImagePages } from '@/lib/use-image-pages'

import {
  createFeedServer,
  feedFetch,
  feedRecord,
  type ImageFeedServer,
} from './helpers/image-feed-server'
import { required } from './helpers/required'

let server: ImageFeedServer

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  return feedFetch(server)(input, init)
})

function favoriteOf(records: ImageRecord[]): boolean | undefined {
  const saved = records[0]?.outputs[0]

  return saved?.status === 'saved' ? saved.favorite : undefined
}

function stalePage(): ImageListResult {
  return { items: server.records, nextCursor: null, activeCount: server.activeCount }
}

function deferred() {
  return Promise.withResolvers<void>()
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
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('optimistic image favorite', () => {
  it('shows the like before the PATCH resolves and survives an older poll', async () => {
    server.records = [feedRecord('a', false)]

    let releasePatch: (() => void) | undefined

    server.patchGate = new Promise<void>((resolve) => {
      releasePatch = resolve
    })

    const { result } = renderHook(
      () => {
        return useImagePages({ filters: {} })
      },
      { wrapper: SwrWrapper },
    )

    await waitFor(() => {
      expect(result.current.records).toHaveLength(1)
    })

    const epoch = currentFavoriteEpoch()
    const [item] = imageItems(required(result.current.records[0], 'image record'))
    const pending = favoriteImageItem(required(item, 'image item'))

    await act(async () => {})

    expect(favoriteOf(result.current.records)).toBe(true)

    const stale = stalePage()

    await act(async () => {
      await result.current.mutate(
        (pages) => {
          return patchImagePages({ pages: pages ?? [], polled: stale, epoch })
        },
        { revalidate: false },
      )
    })

    expect(favoriteOf(result.current.records)).toBe(true)

    await act(async () => {
      releasePatch?.()
      await pending
    })
  })
})

describe('serialized image favorite', () => {
  it('keeps the last click when two likes arrive before the first PATCH resolves', async () => {
    server.records = [feedRecord('a', false)]

    let releasePatch: (() => void) | undefined

    server.patchGate = new Promise<void>((resolve) => {
      releasePatch = resolve
    })

    const { result } = renderHook(
      () => {
        return useImagePages({ filters: {} })
      },
      { wrapper: SwrWrapper },
    )

    await waitFor(() => {
      expect(result.current.records).toHaveLength(1)
    })

    const [item] = imageItems(required(result.current.records[0], 'image record'))
    const first = favoriteImageItem(required(item, 'image item'))

    await waitFor(() => {
      expect(favoriteOf(result.current.records)).toBe(true)
    })

    const second = favoriteImageItem(required(item, 'image item'))

    await waitFor(() => {
      expect(favoriteOf(result.current.records)).toBe(false)
    })

    expect(server.patchBodies).toEqual([true])

    await act(async () => {
      releasePatch?.()
      await Promise.all([first, second])
    })

    expect(server.patchBodies).toEqual([true, false])

    await waitFor(() => {
      expect(favoriteOf(result.current.records)).toBe(false)
    })
  })
})

describe('second image favorite', () => {
  it('keeps the second click while the first queued PATCH settles', async () => {
    server.records = [feedRecord('a', false)]

    const firstGate = deferred()
    const secondGate = deferred()

    server.patchGate = firstGate.promise

    const { result } = renderHook(
      () => {
        return useImagePages({ filters: {} })
      },
      { wrapper: SwrWrapper },
    )

    await waitFor(() => {
      expect(result.current.records).toHaveLength(1)
    })

    const [item] = imageItems(required(result.current.records[0], 'image record'))
    const first = favoriteImageItem(required(item, 'image item'))

    await waitFor(() => {
      expect(favoriteOf(result.current.records)).toBe(true)
    })

    await waitFor(() => {
      expect(server.patchBodies).toEqual([true])
    })

    const second = favoriteImageItem(required(item, 'image item'))

    await waitFor(() => {
      expect(favoriteOf(result.current.records)).toBe(false)
    })

    server.patchGate = secondGate.promise
    firstGate.resolve()

    await act(async () => {
      await first
    })

    expect(favoriteOf(result.current.records)).toBe(false)

    await act(async () => {
      secondGate.resolve()
      await second
    })

    expect(server.patchBodies).toEqual([true, false])
    expect(favoriteOf(result.current.records)).toBe(false)
  })
})

describe('liked image feed', () => {
  it('removes the tile from the liked feed after an unlike', async () => {
    server.records = [feedRecord('a', true)]

    const { result } = renderHook(
      () => {
        return useImagePages({ filters: { favorite: true } })
      },
      { wrapper: SwrWrapper },
    )

    await waitFor(() => {
      expect(result.current.records).toHaveLength(1)
    })

    const [item] = imageItems(required(result.current.records[0], 'image record'))
    const pending = favoriteImageItem(required(item, 'image item'))

    await act(async () => {
      await pending
    })

    await waitFor(() => {
      expect(result.current.records).toHaveLength(0)
    })
  })
})
