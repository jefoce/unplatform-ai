// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HistoryTile } from '@/features/history/list/HistoryTile'

import type { ImageOutput, ImageRecord } from '../src/core/schemas/image-record'
import { imageItems, videoItem } from '../src/lib/feed/output-items'
import { handleNoop, Observer, record } from './helpers/history'
import { required } from './helpers/required'

const createImage = vi.hoisted(() => {
  return vi.fn()
})

const createGeneration = vi.hoisted(() => {
  return vi.fn()
})

const platformMock = vi.hoisted(() => {
  return {
    confirm: vi.fn(),
    saveVideo: vi.fn(),
    saveVideos: vi.fn(),
    saveImages: vi.fn(),
  }
})

vi.mock('@/lib/api/images', () => {
  return {
    cancelImageRequest: vi.fn(),
    createImage,
    deleteImageOutput: vi.fn(),
    deleteImageRecord: vi.fn(),
    refreshImages: vi.fn(),
    revealImageOutput: vi.fn(),
    setOutputFavorite: vi.fn(),
    useImageOutputAsFrame: vi.fn(),
  }
})

vi.mock('@/lib/api/generations', () => {
  return {
    cancelGenerationRequest: vi.fn(),
    captureGenerationFrame: vi.fn(),
    createGeneration,
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
  return { platform: platformMock }
})

vi.mock('sonner', () => {
  return { toast: { success: vi.fn(), error: vi.fn() } }
})

const RECORD_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const OUTPUT_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3302'

function savedOutput(): ImageOutput {
  return {
    id: OUTPUT_ID,
    index: 0,
    status: 'saved',
    file: 'image-0.png',
    mediaType: 'image/png',
    width: 1024,
    height: 1024,
    bytes: 2048,
    favorite: false,
    seed: null,
  }
}

function imageRecord(isSaved: boolean): ImageRecord {
  const createdAt = '2026-01-01T00:00:00.000Z'

  return {
    id: RECORD_ID,
    createdAt,
    updatedAt: createdAt,
    status: isSaved ? 'completed' : 'failed',
    provider: 'openrouter',
    preset: { id: 'gpt-image-2.5-sunburst', title: 'GPT Image 2.5 Sunburst', slug: 'sunburst' },
    input: {
      presetId: 'gpt-image-2.5-sunburst',
      prompt: 'a cat',
      count: 1,
      aspectRatio: '1:1',
      resolution: null,
      quality: 'high',
      background: 'auto',
      references: [],
      seed: 123,
    },
    outputs: isSaved
      ? [savedOutput()]
      : [{ id: OUTPUT_ID, index: 0, status: 'failed', error: 'No' }],
    seedUsed: 123,
    cost: {
      currency: 'USD',
      unit: 'token',
      estimatedUsd: 0.2,
      actualUsd: null,
      priceSource: 'mock',
      billed: null,
    },
  }
}

function imageTile(item: ReturnType<typeof imageItems>[number]) {
  return <HistoryTile item={item} zoom={0} onOpen={handleNoop} mediaWidth={0} />
}

function videoTile(item: ReturnType<typeof videoItem>) {
  return <HistoryTile item={item} zoom={0} onOpen={handleNoop} mediaWidth={0} />
}

async function openMenu(): Promise<void> {
  fireEvent.pointerDown(screen.getByRole('button', { name: 'More actions' }), {
    button: 0,
    ctrlKey: false,
  })

  await screen.findByRole('menuitem', { name: 'Reuse prompt' })
}

const SAVED_IMAGE_REF = {
  recordId: RECORD_ID,
  outputId: OUTPUT_ID,
  file: 'image-0.png',
}

beforeEach(() => {
  createImage.mockReset()
  createGeneration.mockReset()
  platformMock.saveImages.mockReset()
  platformMock.saveImages.mockResolvedValue({ saved: 1, skipped: 0 })
  vi.stubGlobal('IntersectionObserver', Observer)
  vi.stubGlobal('ResizeObserver', Observer)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('saved image card', () => {
  it('puts the heart first and the reference after the download', async () => {
    const [item] = imageItems(imageRecord(true))

    render(imageTile(required(item, 'image item')))

    expect(screen.getByRole('button', { name: 'Like' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Download' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Reference' })).not.toBeNull()

    await openMenu()

    for (const name of ['Regenerate', 'Show in folder', 'Download', 'Reuse prompt', 'Delete']) {
      expect(screen.getByRole('menuitem', { name })).not.toBeNull()
    }
  })

  it('saves one image from the card action and the menu item', async () => {
    const [item] = imageItems(imageRecord(true))

    render(imageTile(required(item, 'image item')))

    fireEvent.click(screen.getByRole('button', { name: 'Download' }))

    await waitFor(() => {
      expect(platformMock.saveImages).toHaveBeenCalledWith([SAVED_IMAGE_REF])
    })

    platformMock.saveImages.mockClear()
    await openMenu()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Download' }))

    await waitFor(() => {
      expect(platformMock.saveImages).toHaveBeenCalledWith([SAVED_IMAGE_REF])
    })
  })
})

describe('failed image card', () => {
  it('puts regenerate first, delete second and keeps reuse in the menu', async () => {
    const [item] = imageItems(imageRecord(false))

    render(imageTile(required(item, 'image item')))

    expect(screen.getByRole('button', { name: 'Regenerate' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Delete' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Like' })).toBeNull()

    const labels = screen.getAllByRole('button').map((button) => {
      return button.getAttribute('aria-label')
    })

    expect(labels.indexOf('Regenerate')).toBeLessThan(labels.indexOf('Delete'))

    await openMenu()

    expect(screen.getByRole('menuitem', { name: 'Reuse prompt' })).not.toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'Show in folder' })).toBeNull()
  })

  it('resubmits the record input with its locked seed', async () => {
    const base = imageRecord(false)
    const source = { ...base, cost: { ...base.cost, actualUsd: 0.99 } }
    const [item] = imageItems(source)

    render(imageTile(required(item, 'image item')))

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }))

    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByText('Regenerate 1 image for ~$0.12?')).not.toBeNull()
    expect(createImage).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Regenerate' }))

    await waitFor(() => {
      expect(createImage).toHaveBeenCalledWith(source.input)
    })
  })
})

describe('saved video card', () => {
  it('keeps the heart first and the download second', async () => {
    render(videoTile(videoItem(record('v'))))

    expect(screen.getByRole('button', { name: 'Like' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Download' })).not.toBeNull()

    await openMenu()

    for (const name of ['Regenerate', 'Show in folder', 'Reuse prompt', 'Delete']) {
      expect(screen.getByRole('menuitem', { name })).not.toBeNull()
    }
  })
})

describe('failed video card', () => {
  it('replaces the heart with regenerate and keeps reuse and delete', async () => {
    render(videoTile(videoItem(record('v', { status: 'failed' }))))

    expect(screen.getByRole('button', { name: 'Regenerate' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Like' })).toBeNull()

    await openMenu()

    expect(screen.getByRole('menuitem', { name: 'Reuse prompt' })).not.toBeNull()
    expect(screen.getByRole('menuitem', { name: 'Delete' })).not.toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'Download' })).toBeNull()
  })

  it('resubmits the record input with its locked seed', async () => {
    const base = record('v', { status: 'failed' })

    const source = {
      ...base,
      input: { ...base.input, seed: 123 },
      cost: { ...base.cost, actualUsd: 9.99 },
    }

    render(videoTile(videoItem(source)))

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }))

    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByText('Regenerate this video for ~$1.50?')).not.toBeNull()
    expect(createGeneration).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Regenerate' }))

    await waitFor(() => {
      expect(createGeneration).toHaveBeenCalledWith(source.input)
    })
  })
})
