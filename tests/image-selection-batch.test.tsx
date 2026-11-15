// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HistoryGrid } from '@/features/history/list/HistoryGrid'
import { imageSaveRefs } from '@/features/history/selection/selection-actions'
import { useSelectionStore } from '@/features/history/selection/selection-store'
import { SelectionBar } from '@/features/history/selection/SelectionBar'

import { ZOOM_DEFAULT } from '../src/core/constants'
import { handleNoop, Observer } from './helpers/history'
import {
  IMAGE_RECORD_ID,
  imageItemsOf,
  mixedImageItems,
  PLACEHOLDER_RECORD_ID,
} from './helpers/image-history'
import { required } from './helpers/required'

const apiPost = vi.hoisted(() => {
  return vi.fn()
})

const platformMock = vi.hoisted(() => {
  return {
    confirm: vi.fn(async () => {
      return true
    }),
    saveVideo: vi.fn(),
    saveVideos: vi.fn(),
    saveImages: vi.fn(),
  }
})

const toastMock = vi.hoisted(() => {
  return Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() })
})

vi.mock('@/lib/fetcher', () => {
  return {
    apiPost,
    apiPatch: vi.fn(),
    fetcher: vi.fn(),
    ApiError: class ApiError extends Error {
      status = 0
    },
  }
})

vi.mock('sonner', () => {
  return { toast: toastMock }
})

vi.mock('@/lib/platform', () => {
  return { platform: platformMock }
})

const items = mixedImageItems()

const SELECTABLE_IDS = items
  .filter((item) => {
    return item.canSelect
  })
  .map((item) => {
    return item.id
  })

const ALL_IDS = items.map((item) => {
  return item.id
})

function select(ids: string[]): void {
  act(() => {
    useSelectionStore.getState().setMany(ids, true)
  })
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', Observer)
  vi.stubGlobal('ResizeObserver', Observer)
  useSelectionStore.getState().clear()
  useSelectionStore.getState().setOrder(SELECTABLE_IDS)
  apiPost.mockReset()
  platformMock.saveImages.mockReset()
  toastMock.mockReset()
})

afterEach(() => {
  cleanup()
  useSelectionStore.getState().clear()
  vi.unstubAllGlobals()
})

describe('image selection rules', () => {
  it('shows a labelled checkbox on saved, failed and placeholder items, not pending', () => {
    const { container } = render(
      <HistoryGrid items={items} zoom={ZOOM_DEFAULT} onOpen={handleNoop} />,
    )

    const boxes = screen.getAllByRole('checkbox')

    expect(boxes).toHaveLength(3)

    expect(boxes[0]?.getAttribute('aria-label')).toBe('Select Nano Banana a cat')
    expect(container.querySelector('#history-item-pending-id [role="checkbox"]')).toBeNull()
  })

  it('downloads only saved images and reports the skip count', async () => {
    platformMock.saveImages.mockResolvedValue({ saved: 1, skipped: 0 })
    select(ALL_IDS)
    render(<SelectionBar items={items} />)

    fireEvent.click(screen.getByRole('button', { name: 'Download 1' }))

    await waitFor(() => {
      expect(platformMock.saveImages).toHaveBeenCalledWith([
        {
          recordId: IMAGE_RECORD_ID,
          outputId: 'saved-id',
          file: 'saved-id.png',
          name: 'nano-banana',
        },
      ])
    })

    expect(platformMock.saveVideos).not.toHaveBeenCalled()
    expect(toastMock).toHaveBeenCalledWith('3 not finished, skipped')
  })

  it('names one saved image after the model, or the prompt when unnamed', () => {
    const named = required(imageItemsOf(['saved-id'])[0], 'image item')
    const unnamed = required(imageItemsOf(['saved-id'])[0], 'image item')

    const unnamedItem = {
      ...unnamed,
      source: { ...unnamed.source, preset: { ...unnamed.source.preset, title: '' } },
    }

    expect(
      imageSaveRefs([named]).map((ref) => {
        return ref.name
      }),
    ).toEqual(['nano-banana'])

    expect(
      imageSaveRefs([unnamedItem]).map((ref) => {
        return ref.name
      }),
    ).toEqual(['a-cat'])
  })

  it('deletes the placeholder by record id', async () => {
    apiPost.mockResolvedValue({ done: ['saved-id', `${PLACEHOLDER_RECORD_ID}:0`], skipped: [] })
    select(['saved-id', `${PLACEHOLDER_RECORD_ID}:0`])
    render(<SelectionBar items={items} />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete selected images' }))

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/api/images/batch', {
        action: 'delete',
        outputs: [
          { recordId: IMAGE_RECORD_ID, outputId: 'saved-id' },
          { recordId: PLACEHOLDER_RECORD_ID, outputId: null },
        ],
      })
    })
  })
})
