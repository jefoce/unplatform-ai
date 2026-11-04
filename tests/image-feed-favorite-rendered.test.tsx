// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FeedSection } from '@/features/history/list/FeedSection'
import { useStableItems } from '@/features/history/list/use-stable-items'
import { imageItems } from '@/lib/feed/output-items'
import { useImagePages } from '@/lib/use-image-pages'

import { Observer } from './helpers/history'
import {
  createFeedServer,
  feedFetch,
  feedRecord,
  type ImageFeedServer,
} from './helpers/image-feed-server'
import { required } from './helpers/required'

const FILTERS = {}
const PADDING = { base: 'pb-60', selecting: 'pb-60' }

const noop = () => {}

let server: ImageFeedServer

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  return feedFetch(server)(input, init)
})

function FeedHarness() {
  const { records, isLoading } = useImagePages({ filters: FILTERS })

  const loadedItems = records.flatMap((record) => {
    return imageItems(record)
  })

  const items = useStableItems(loadedItems)

  return (
    <FeedSection
      items={items}
      isLoading={isLoading}
      hasMore={false}
      isLoadingMore={false}
      error={undefined}
      loadMore={noop}
      onRetry={noop}
      view="grid"
      zoom={5}
      filters={FILTERS}
      toolbar={null}
      emptyKind="image"
      padding={PADDING}
    />
  )
}

function renderFeed(): void {
  render(
    <SWRConfig
      value={{
        provider: () => {
          return new Map()
        },
        dedupingInterval: 0,
      }}
    >
      <FeedHarness />
    </SWRConfig>,
  )
}

function gatePatch(): () => void {
  let release: (() => void) | undefined

  server.patchGate = new Promise<void>((resolve) => {
    release = resolve
  })

  return () => {
    release?.()
  }
}

function likedButtons(): HTMLElement[] {
  return screen.queryAllByRole('button', { name: 'Liked' })
}

beforeEach(() => {
  server = createFeedServer()
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('ResizeObserver', Observer)
  vi.stubGlobal('IntersectionObserver', Observer)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('image favorite in the rendered feed', () => {
  it('fills the heart on the first click before the PATCH resolves', async () => {
    server.records = [feedRecord('a', false)]
    const releasePatch = gatePatch()

    renderFeed()

    fireEvent.click(await screen.findByRole('button', { name: 'Like' }))

    await waitFor(() => {
      expect(likedButtons().length).toBeGreaterThan(0)
    })

    await act(async () => {
      releasePatch()
    })

    await waitFor(() => {
      expect(server.patchBodies).toEqual([true])
    })
  })

  it('sends the opposite favorite when clicked again before the PATCH resolves', async () => {
    server.records = [feedRecord('a', false)]
    const releasePatch = gatePatch()

    renderFeed()

    fireEvent.click(await screen.findByRole('button', { name: 'Like' }))

    await waitFor(() => {
      expect(likedButtons().length).toBeGreaterThan(0)
    })

    fireEvent.click(required(likedButtons()[0], 'remove favorite button'))

    await act(async () => {
      releasePatch()
    })

    await waitFor(() => {
      expect(likedButtons()).toHaveLength(0)
      expect(screen.getAllByRole('button', { name: 'Like' })).toHaveLength(1)
    })

    expect(server.patchBodies).toEqual([true, false])
  })
})
