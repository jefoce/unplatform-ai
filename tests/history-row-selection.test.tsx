// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HistoryRow } from '@/features/history/list/HistoryRow'
import { useSelectionStore } from '@/features/history/selection/selection-store'

import { ids, Observer, record, setOrder, setSelection } from './helpers/history'
import { required } from './helpers/required'

const play = vi.fn()

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

function clickPoster(container: HTMLElement, isShiftKey = false): void {
  fireEvent.click(required(container.querySelector('img'), 'poster'), { shiftKey: isShiftKey })
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', Observer)
  vi.stubGlobal('ResizeObserver', Observer)
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play })
  useSelectionStore.getState().clear()
  play.mockClear()
})

afterEach(() => {
  cleanup()
  useSelectionStore.getState().clear()
  vi.unstubAllGlobals()
})

describe('history row selection', () => {
  it('selects and unselects a row with two clicks while selecting', () => {
    setOrder(['a', 'b'])
    setSelection(['b'])
    const { container } = render(<HistoryRow record={record('a')} />)

    clickPoster(container)
    expect(ids()).toEqual(['b', 'a'])

    clickPoster(container)
    expect(ids()).toEqual(['b'])
  })

  it('unselects a selected row from its media without playing the video', () => {
    setOrder(['a'])
    setSelection(['a'])
    const { container } = render(<HistoryRow record={record('a')} />)

    clickPoster(container)

    expect(ids()).toEqual([])
    expect(play).not.toHaveBeenCalled()
  })

  it('keeps the shift range from the last plain click', () => {
    setOrder(['a', 'b', 'c', 'd'])

    act(() => {
      useSelectionStore.getState().toggle('b')
    })

    const { container } = render(<HistoryRow record={record('d')} />)

    clickPoster(container, true)

    expect(ids()).toEqual(['b', 'c', 'd'])
  })
})
