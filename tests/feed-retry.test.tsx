// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ImageListResult } from '@/core/api/image'
import type { GenerationListResult } from '@/core/api/video'
import type * as GenerationsModule from '@/lib/api/generations'
import type * as ImagesModule from '@/lib/api/images'
import { SessionError } from '@/lib/fetcher'

import { record } from './helpers/history'
import { createFeedServer, feedRecord, type ImageFeedServer } from './helpers/image-feed-server'
import { ImageRetryFeed } from './helpers/image-retry-feed'
import { VideoRetryFeed } from './helpers/video-retry-feed'

const mocks = vi.hoisted(() => {
  return { fetchImagePage: vi.fn(), fetchGenerationPage: vi.fn() }
})

vi.mock('@/lib/api/images', async (importOriginal) => {
  const actual = await importOriginal<typeof ImagesModule>()

  return { ...actual, fetchImagePage: mocks.fetchImagePage }
})

vi.mock('@/lib/api/generations', async (importOriginal) => {
  const actual = await importOriginal<typeof GenerationsModule>()

  return { ...actual, fetchGenerationPage: mocks.fetchGenerationPage }
})

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function SwrWrapper(props: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        provider: () => {
          return new Map()
        },
        dedupingInterval: 0,
        shouldRetryOnError: false,
      }}
    >
      {props.children}
    </SWRConfig>
  )
}

let server: ImageFeedServer

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', Observer)
  vi.stubGlobal('ResizeObserver', Observer)

  server = createFeedServer()
  mocks.fetchImagePage.mockReset()
  mocks.fetchGenerationPage.mockReset()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('failed first feed page', () => {
  it('shows a retry in the image tab and loads after clicking it', async () => {
    const page: ImageListResult = {
      items: [feedRecord('a', false)],
      nextCursor: null,
      activeCount: server.activeCount,
    }

    mocks.fetchImagePage.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(page)

    render(
      <SwrWrapper>
        <ImageRetryFeed />
      </SwrWrapper>,
    )

    expect(await screen.findByText("Couldn't load.")).not.toBeNull()
    expect(mocks.fetchImagePage).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(mocks.fetchImagePage).toHaveBeenCalledTimes(2)
    })

    expect(await screen.findByRole('button', { name: 'Open image details' })).not.toBeNull()
  })

  it('shows the session message instead of a retry on 401', async () => {
    mocks.fetchImagePage.mockRejectedValueOnce(
      new SessionError({ status: 401, message: 'No session' }),
    )

    render(
      <SwrWrapper>
        <ImageRetryFeed />
      </SwrWrapper>,
    )

    expect(await screen.findByText('Session lost. Restart the app.')).not.toBeNull()
    expect(screen.queryByText("Couldn't load.")).toBeNull()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('shows a retry in the video tab and loads after clicking it', async () => {
    const page: GenerationListResult = {
      items: [record('v')],
      nextCursor: null,
      activeCount: 0,
    }

    mocks.fetchGenerationPage
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(page)

    render(
      <SwrWrapper>
        <VideoRetryFeed />
      </SwrWrapper>,
    )

    expect(await screen.findByText("Couldn't load.")).not.toBeNull()
    expect(mocks.fetchGenerationPage).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(mocks.fetchGenerationPage).toHaveBeenCalledTimes(2)
    })

    expect(await screen.findByRole('button', { name: 'Open video details' })).not.toBeNull()
  })
})
