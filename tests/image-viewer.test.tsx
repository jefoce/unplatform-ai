// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { noop } from 'lodash-es'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useGeneratorStore } from '@/features/generator/store/store'
import { useImageGeneratorStore } from '@/features/image-generator/store'
import { useHistoryViewerStore } from '@/features/shared/history-viewer-store'
import { useImageViewStore } from '@/features/workspace/image-view-store'
import { ImageWorkspace } from '@/features/workspace/ImageWorkspace'

import type { ImageOutput, ImageRecord } from '../src/core/schemas/image-record'
import type { UploadItem } from '../src/core/schemas/upload-item'
import { imageItems } from '../src/lib/feed/output-items'
import { Observer } from './helpers/history'
import { required } from './helpers/required'

const createImageOutputUpload = vi.hoisted(() => {
  return vi.fn()
})

vi.mock('@/lib/api/images', () => {
  return {
    cancelImageRequest: vi.fn(),
    deleteImageOutput: vi.fn(),
    deleteImageRecord: vi.fn(),
    imagePageKey: () => {
      return '/api/images'
    },
    refreshImages: vi.fn(),
    revealImageOutput: vi.fn(),
    setOutputFavorite: vi.fn(),
    createImageOutputUpload,
  }
})

const FEED_PROPS = {
  isLoading: false,
  hasMore: false,
  isLoadingMore: false,
  error: undefined,
  loadMore: noop,
  onRetry: async () => {},
}

const SAVED_IDS = [
  '3f2504e0-4f89-41d3-9a0c-0305e82c3302',
  '3f2504e0-4f89-41d3-9a0c-0305e82c3303',
] as const

const FAILED_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3304'
const PENDING_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3305'
const UPLOAD_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3306'

const UPLOAD: UploadItem = {
  id: UPLOAD_ID,
  source: 'file',
  kind: 'image',
  mime: 'image/png',
  ext: 'png',
  originalName: 'image-0.png',
  sizeBytes: 2048,
  createdAt: '2026-01-01T00:00:00.000Z',
}

function savedOutput(id: string, index: number): ImageOutput {
  return {
    id,
    index,
    status: 'saved',
    file: `image-${index}.png`,
    mediaType: 'image/png',
    width: 1024,
    height: 1024,
    bytes: 2048,
    favorite: false,
    seed: null,
  }
}

const RECORD: ImageRecord = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  status: 'completed',
  provider: 'openrouter',
  preset: { id: 'gemini-3.1-flash-image', title: 'Nano Banana 2', slug: 'gemini' },
  input: {
    presetId: 'gemini-3.1-flash-image',
    prompt: 'a cat',
    count: 4,
    aspectRatio: '1:1',
    resolution: '1K',
    quality: null,
    background: null,
    references: [],
    seed: null,
  },
  outputs: [
    savedOutput(SAVED_IDS[0], 0),
    { id: FAILED_ID, index: 1, status: 'failed', error: 'Rejected' },
    { id: PENDING_ID, index: 2, status: 'pending' },
    savedOutput(SAVED_IDS[1], 3),
  ],
  seedUsed: null,
  cost: {
    currency: 'USD',
    unit: 'image',
    estimatedUsd: 0.02,
    actualUsd: 0.02,
    priceSource: 'mock',
    billed: true,
  },
}

function tileOf(container: HTMLElement, id: string): HTMLElement {
  return required(container.querySelector<HTMLElement>(`#history-item-${id} [role="button"]`), id)
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  useHistoryViewerStore.getState().close()
  useImageViewStore.getState().setView('grid')
  useGeneratorStore.setState({ presetId: 'seedance-2.0', references: [], uploadsById: {} })

  useImageGeneratorStore.setState({
    presetId: 'gemini-3.1-flash-image',
    references: [],
    uploadsById: {},
  })

  createImageOutputUpload.mockReset()
  vi.stubGlobal('ResizeObserver', Observer)
  vi.stubGlobal('IntersectionObserver', Observer)
})

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  useHistoryViewerStore.getState().close()
  vi.unstubAllGlobals()
})

describe('image viewer', () => {
  it('opens and navigates saved outputs only', () => {
    const { container } = render(<ImageWorkspace items={imageItems(RECORD)} {...FEED_PROPS} />)

    for (const id of [FAILED_ID, PENDING_ID]) {
      fireEvent.click(tileOf(container, id))

      expect(useHistoryViewerStore.getState().selectedId).toBeNull()
    }

    fireEvent.click(tileOf(container, SAVED_IDS[0]))

    expect(useHistoryViewerStore.getState().selectedId).toBe(SAVED_IDS[0])

    fireEvent.keyDown(document.body, { key: 'ArrowRight' })

    expect(useHistoryViewerStore.getState().selectedId).toBe(SAVED_IDS[1])
  })

  it('zooms the image stage and resets the zoom on the next item', () => {
    const { container } = render(<ImageWorkspace items={imageItems(RECORD)} {...FEED_PROPS} />)

    fireEvent.click(tileOf(container, SAVED_IDS[0]))

    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '100%' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))

    expect(screen.getByRole('button', { name: '150%' })).toBeTruthy()

    fireEvent.keyDown(document.body, { key: 'ArrowRight' })

    expect(screen.getByRole('button', { name: '100%' })).toBeTruthy()
  })

  it('adds the reference to the image draft in the image workspace', async () => {
    window.history.replaceState(null, '', '/?tab=image')
    createImageOutputUpload.mockResolvedValue(UPLOAD)

    const { container } = render(<ImageWorkspace items={imageItems(RECORD)} {...FEED_PROPS} />)

    fireEvent.click(tileOf(container, SAVED_IDS[0]))

    const [reference] = await screen.findAllByRole('button', { name: 'Reference' })

    fireEvent.click(required(reference, 'reference action'))

    await waitFor(() => {
      expect(createImageOutputUpload).toHaveBeenCalledWith({
        recordId: RECORD.id,
        outputId: SAVED_IDS[0],
      })
    })

    await waitFor(() => {
      expect(useImageGeneratorStore.getState().references).toEqual([UPLOAD.id])
    })

    expect(useGeneratorStore.getState().references).toEqual([])
    expect(useHistoryViewerStore.getState().selectedId).toBeNull()
  })

  it('adds the reference to the video draft in the video workspace', async () => {
    createImageOutputUpload.mockResolvedValue(UPLOAD)

    const { container } = render(<ImageWorkspace items={imageItems(RECORD)} {...FEED_PROPS} />)

    fireEvent.click(tileOf(container, SAVED_IDS[0]))

    const [reference] = await screen.findAllByRole('button', { name: 'Reference' })

    fireEvent.click(required(reference, 'reference action'))

    await waitFor(() => {
      expect(useGeneratorStore.getState().references).toEqual([UPLOAD.id])
    })

    expect(useImageGeneratorStore.getState().references).toEqual([])
    expect(useHistoryViewerStore.getState().selectedId).toBeNull()
  })
})
