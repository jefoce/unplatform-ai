// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HistoryTile } from '@/features/history/list/HistoryTile'
import { useSelectionStore } from '@/features/history/selection/selection-store'
import { useHistoryViewerStore } from '@/features/shared/history-viewer-store'

import { ZOOM_DEFAULT } from '../src/core/constants'
import type { HistoryItem } from '../src/lib/feed/output-items'
import { item, Observer } from './helpers/history'
import { imageItemsOf, mixedImageItems } from './helpers/image-history'
import { required } from './helpers/required'

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

vi.mock('sonner', () => {
  return { toast: { success: vi.fn(), error: vi.fn() } }
})

function renderTile(historyItem: HistoryItem, onOpen: (opened: HistoryItem) => void) {
  return render(
    <HistoryTile item={historyItem} zoom={ZOOM_DEFAULT} onOpen={onOpen} mediaWidth={0} />,
  )
}

beforeEach(() => {
  useSelectionStore.getState().clear()
  useHistoryViewerStore.getState().close()
  vi.stubGlobal('IntersectionObserver', Observer)
  vi.stubGlobal('ResizeObserver', Observer)
})

afterEach(() => {
  cleanup()
  useSelectionStore.getState().clear()
  useHistoryViewerStore.getState().close()
  vi.unstubAllGlobals()
})

describe('history tile focus', () => {
  it('keeps an active video in the tab order and opens it on Enter', () => {
    const onOpen = vi.fn()
    const active = item('active', { status: 'in_progress' })

    renderTile(active, onOpen)

    const tile = screen.getByRole('button', { name: 'Open video details' })

    expect(tile.tabIndex).toBe(0)
    expect(tile.getAttribute('aria-disabled')).toBe('false')

    fireEvent.keyDown(tile, { key: 'Enter' })

    expect(onOpen).toHaveBeenCalledWith(active)
  })

  it('keeps a pending image out of the tab order and does not open it', () => {
    const onOpen = vi.fn()

    const pending = required(
      mixedImageItems().find((candidate) => {
        return candidate.recordKind === 'image' && candidate.output?.status === 'pending'
      }),
      'pending image',
    )

    renderTile(pending, onOpen)

    const tile = screen.getByRole('button', { name: 'Open image details' })

    expect(tile.tabIndex).toBe(-1)
    expect(tile.getAttribute('aria-disabled')).toBe('true')

    fireEvent.keyDown(tile, { key: 'Enter' })

    expect(onOpen).not.toHaveBeenCalled()
  })

  it('keeps a saved image focusable', () => {
    const onOpen = vi.fn()
    const saved = required(imageItemsOf(['saved-id'])[0], 'saved image')

    renderTile(saved, onOpen)

    const tile = screen.getByRole('button', { name: 'Open image details' })

    expect(tile.tabIndex).toBe(0)
    expect(tile.getAttribute('aria-disabled')).toBe('false')
  })
})
