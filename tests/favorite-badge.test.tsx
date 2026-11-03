// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HistoryTile } from '@/features/history/list/HistoryTile'
import { setFavorite } from '@/lib/api/generations'
import { setOutputFavorite } from '@/lib/api/images'
import { refreshImages } from '@/lib/image-feed-refresh'

import { videoItem } from '../src/lib/feed/output-items'
import { handleNoop, Observer, record } from './helpers/history'
import { imageItemsOf } from './helpers/image-history'
import { required } from './helpers/required'

vi.mock('@/lib/api/images', () => {
  return {
    cancelImageRequest: vi.fn(),
    createImage: vi.fn(),
    deleteImageOutput: vi.fn(),
    deleteImageRecord: vi.fn(),
    revealImageOutput: vi.fn(),
    setOutputFavorite: vi.fn(),
    useImageOutputAsFrame: vi.fn(),
  }
})

vi.mock('@/lib/image-feed-refresh', () => {
  return {
    patchImageFeeds: vi.fn(() => {
      return Promise.resolve()
    }),
    readImageFeedPages: vi.fn(() => {
      return Promise.resolve([])
    }),
    refreshImages: vi.fn(),
  }
})

vi.mock('@/lib/api/generations', () => {
  return {
    cancelGenerationRequest: vi.fn(),
    captureGenerationFrame: vi.fn(),
    createGeneration: vi.fn(),
    deleteGeneration: vi.fn(),
    fetchGenerationsByIds: vi.fn(),
    fetchUploadsByIds: vi.fn(),
    retryDownloadRequest: vi.fn(),
    revealGeneration: vi.fn(),
    setFavorite: vi.fn(),
  }
})

vi.mock('@/lib/api/credits', () => {
  return { refreshCredits: vi.fn() }
})

vi.mock('@/lib/api/uploads', () => {
  return { linkFolderFile: vi.fn(), linkGenerationFile: vi.fn(), linkUpload: vi.fn() }
})

vi.mock('@/lib/fetcher', () => {
  return {
    apiDelete: vi.fn(),
    apiPatch: vi.fn(),
    apiPost: vi.fn(),
    fetcher: vi.fn(),
    ApiError: class ApiError extends Error {
      status = 0
    },
  }
})

vi.mock('@/lib/platform', () => {
  return {
    platform: { confirm: vi.fn(), saveVideo: vi.fn(), saveVideos: vi.fn() },
  }
})

vi.mock('sonner', () => {
  return { toast: { success: vi.fn(), error: vi.fn() } }
})

function badge(): HTMLElement {
  return required(screen.getByText('1').closest('button'), 'favorite badge')
}

beforeEach(() => {
  vi.mocked(setFavorite).mockReset()
  vi.mocked(refreshImages).mockReset()
  vi.mocked(setOutputFavorite).mockReset()
  vi.stubGlobal('IntersectionObserver', Observer)
  vi.stubGlobal('ResizeObserver', Observer)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('favorite badge', () => {
  it('unlikes an image output and refreshes the image feed', async () => {
    const [item] = imageItemsOf(['output-1'], true)
    const imageItem = required(item, 'image item')

    render(<HistoryTile item={imageItem} zoom={0} onOpen={handleNoop} />)

    fireEvent.click(badge())

    await waitFor(() => {
      expect(setOutputFavorite).toHaveBeenCalledWith({
        recordId: imageItem.recordId,
        outputId: 'output-1',
        favorite: false,
      })

      expect(refreshImages).toHaveBeenCalled()
    })

    expect(setFavorite).not.toHaveBeenCalled()
  })

  it('keeps video favorites on the record path', async () => {
    render(
      <HistoryTile
        item={videoItem(record('v', { favorite: true }))}
        zoom={0}
        onOpen={handleNoop}
      />,
    )

    fireEvent.click(badge())

    await waitFor(() => {
      expect(setFavorite).toHaveBeenCalledWith('v', false)
    })

    expect(setOutputFavorite).not.toHaveBeenCalled()
    expect(refreshImages).not.toHaveBeenCalled()
  })
})
