// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import { useHistoryViewerStore } from '@/features/history/list/history-viewer-store'
import { HistoryModal } from '@/features/history/list/HistoryModal'

import { handleNoop, Observer, record, releaseAllSlots } from './helpers/history'
import { required } from './helpers/required'

vi.mock('@/lib/fetcher', () => {
  return {
    apiPost: vi.fn(),
    apiDelete: vi.fn(),
    apiPatch: vi.fn(),
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

interface ModalParams {
  record: GenerationRecord | null
  selectedId: string
  viewOrder: string[]
  isOpen?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
}

function modal(params: ModalParams) {
  const {
    record: selectedRecord,
    selectedId,
    viewOrder,
    isOpen = true,
    hasMore = false,
    onLoadMore = handleNoop,
  } = params

  if (isOpen) {
    useHistoryViewerStore.getState().open(selectedId)
  } else {
    useHistoryViewerStore.getState().close()
  }

  return (
    <HistoryModal
      record={selectedRecord}
      viewOrder={viewOrder}
      hasMore={hasMore}
      isLoadingMore={false}
      onLoadMore={onLoadMore}
    />
  )
}

const play = vi.fn(() => {
  return Promise.resolve()
})

const pause = vi.fn()
const load = vi.fn()

beforeEach(() => {
  useHistoryViewerStore.getState().close()
  vi.stubGlobal('IntersectionObserver', Observer)
  vi.stubGlobal('ResizeObserver', Observer)
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pause })
  Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: load })
})

afterEach(() => {
  cleanup()
  useHistoryViewerStore.getState().close()
  releaseAllSlots()
  play.mockClear()
  pause.mockClear()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('HistoryModal', () => {
  it('fills the window, with a close button that closes the viewer', () => {
    render(modal({ record: record('v'), selectedId: 'v', viewOrder: ['v'] }))

    const dialog = screen.getByRole('dialog')

    expect(dialog.className).toContain('max-w-450')
    expect(dialog.querySelector('.w-80')).not.toBeNull()

    const backdrop = dialog.querySelector('img.blur-3xl')

    expect(backdrop?.getAttribute('alt')).toBe('')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(useHistoryViewerStore.getState().selectedId).toBeNull()
  })
})

describe('HistoryModal player aspect', () => {
  it('sizes the player box from the output width and height', () => {
    const completed: GenerationRecord = {
      ...record('v'),
      output: { video: 'v.mp4', width: 1920, height: 1080 },
    }

    render(modal({ record: completed, selectedId: 'v', viewOrder: ['v'] }))

    const box = screen.getByRole('dialog').querySelector<HTMLElement>('[style*="aspect-ratio"]')

    expect(box?.style.aspectRatio).toBe('1920/1080')
  })

  it('falls back to the selected ratio when the output has no size', () => {
    const base = record('v')

    const portrait: GenerationRecord = {
      ...base,
      input: { ...base.input, aspectRatio: '9:16' },
      output: { video: 'v.mp4' },
    }

    render(modal({ record: portrait, selectedId: 'v', viewOrder: ['v'] }))

    const box = screen.getByRole('dialog').querySelector<HTMLElement>('[style*="aspect-ratio"]')

    expect(box?.style.aspectRatio).toBe('9/16')
  })
})

describe('HistoryModal arrow keys', () => {
  it('moves to the next record with ArrowRight', () => {
    render(modal({ record: record('a'), selectedId: 'a', viewOrder: ['a', 'b', 'c'] }))

    fireEvent.keyDown(document.body, { key: 'ArrowRight' })

    expect(useHistoryViewerStore.getState().selectedId).toBe('b')
  })

  it('moves to the previous record with ArrowLeft', () => {
    render(modal({ record: record('b'), selectedId: 'b', viewOrder: ['a', 'b', 'c'] }))

    fireEvent.keyDown(document.body, { key: 'ArrowLeft' })

    expect(useHistoryViewerStore.getState().selectedId).toBe('a')
  })

  it('moves with the target on the dialog content right after open', () => {
    render(modal({ record: record('a'), selectedId: 'a', viewOrder: ['a', 'b', 'c'] }))

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' })

    expect(useHistoryViewerStore.getState().selectedId).toBe('b')
  })

  it('moves after a click on the stage background', () => {
    render(modal({ record: record('a'), selectedId: 'a', viewOrder: ['a', 'b', 'c'] }))

    const dialog = screen.getByRole('dialog')
    const stage = required(dialog.querySelector<HTMLElement>('[class*="group/stage"]'), 'stage')

    fireEvent.click(stage)
    fireEvent.keyDown(document.body, { key: 'ArrowRight' })

    expect(useHistoryViewerStore.getState().selectedId).toBe('b')
  })

  it('ignores arrow keys while closed', () => {
    render(
      modal({ record: record('b'), selectedId: 'b', viewOrder: ['a', 'b', 'c'], isOpen: false }),
    )

    fireEvent.keyDown(document.body, { key: 'ArrowRight' })

    expect(useHistoryViewerStore.getState().selectedId).toBeNull()
  })
})

describe('HistoryModal navigation', () => {
  it('moves to the next and previous record in order', () => {
    const { rerender } = render(
      modal({ record: record('a'), selectedId: 'a', viewOrder: ['a', 'b', 'c'] }),
    )

    fireEvent.click(screen.getByLabelText('Next'))

    expect(useHistoryViewerStore.getState().selectedId).toBe('b')

    rerender(modal({ record: record('b'), selectedId: 'b', viewOrder: ['a', 'b', 'c'] }))

    fireEvent.click(screen.getByLabelText('Previous'))

    expect(useHistoryViewerStore.getState().selectedId).toBe('a')
  })

  it('disables previous on the first record and next on the last page', () => {
    const { rerender } = render(
      modal({ record: record('a'), selectedId: 'a', viewOrder: ['a', 'b'] }),
    )

    expect(screen.getByLabelText<HTMLButtonElement>('Previous').disabled).toBe(true)
    expect(screen.getByLabelText<HTMLButtonElement>('Next').disabled).toBe(false)

    rerender(modal({ record: record('b'), selectedId: 'b', viewOrder: ['a', 'b'] }))

    expect(screen.getByLabelText<HTMLButtonElement>('Previous').disabled).toBe(false)
    expect(screen.getByLabelText<HTMLButtonElement>('Next').disabled).toBe(true)
  })

  it('keeps next enabled on the last loaded record when more pages exist', () => {
    const handleLoadMore = vi.fn()

    render(
      modal({
        record: record('c'),
        selectedId: 'c',
        viewOrder: ['a', 'b', 'c'],
        hasMore: true,
        onLoadMore: handleLoadMore,
      }),
    )

    const next = screen.getByLabelText<HTMLButtonElement>('Next')

    expect(next.disabled).toBe(false)

    handleLoadMore.mockClear()
    fireEvent.click(next)

    expect(handleLoadMore).toHaveBeenCalledTimes(1)
  })
})

describe('HistoryModal active records', () => {
  it('shows a running record present in the view order without navigating', () => {
    render(
      modal({
        record: record('b', { status: 'in_progress' }),
        selectedId: 'b',
        viewOrder: ['a', 'b', 'c'],
      }),
    )

    expect(screen.getByText('Prompt b')).not.toBeNull()
    expect(useHistoryViewerStore.getState().selectedId).toBe('b')
  })

  it('steps next and previous across completed, running and failed ids', () => {
    const { rerender } = render(
      modal({ record: record('a'), selectedId: 'a', viewOrder: ['a', 'b', 'c'] }),
    )

    fireEvent.click(screen.getByLabelText('Next'))

    expect(useHistoryViewerStore.getState().selectedId).toBe('b')

    rerender(
      modal({
        record: record('b', { status: 'in_progress' }),
        selectedId: 'b',
        viewOrder: ['a', 'b', 'c'],
      }),
    )

    fireEvent.click(screen.getByLabelText('Next'))

    expect(useHistoryViewerStore.getState().selectedId).toBe('c')

    rerender(
      modal({
        record: record('c', { status: 'failed' }),
        selectedId: 'c',
        viewOrder: ['a', 'b', 'c'],
      }),
    )

    fireEvent.click(screen.getByLabelText('Previous'))

    expect(useHistoryViewerStore.getState().selectedId).toBe('b')
  })

  it('keeps a record selected when it turns completed and does not navigate', () => {
    const { rerender } = render(
      modal({
        record: record('b', { status: 'in_progress' }),
        selectedId: 'b',
        viewOrder: ['a', 'b', 'c'],
      }),
    )

    rerender(modal({ record: record('b'), selectedId: 'b', viewOrder: ['a', 'b', 'c'] }))

    expect(useHistoryViewerStore.getState().selectedId).toBe('b')
    expect(screen.getByText('Prompt b')).not.toBeNull()
  })
})

describe('HistoryModal recovery', () => {
  it('moves to the neighbor when the record drops out of order', () => {
    const { rerender } = render(
      modal({ record: record('b'), selectedId: 'b', viewOrder: ['a', 'b', 'c'] }),
    )

    rerender(modal({ record: null, selectedId: 'b', viewOrder: ['a', 'c'] }))

    expect(useHistoryViewerStore.getState().selectedId).toBe('c')
  })

  it('closes when the last record is deleted', () => {
    render(modal({ record: null, selectedId: 'b', viewOrder: [] }))

    expect(useHistoryViewerStore.getState().selectedId).toBeNull()
  })
})
