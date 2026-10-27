// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AUTOPLAY_DELAY_MS } from '@/core/constants'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import { useHistoryViewerStore } from '@/features/history/list/history-viewer-store'
import { HistoryModal } from '@/features/history/list/HistoryModal'
import { HistoryTile } from '@/features/history/list/HistoryTile'
import { isActive } from '@/features/player/player-slots'

import { Observer, record, releaseAllSlots } from './helpers/history'

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

const play = vi.fn(() => {
  return Promise.resolve()
})

const pause = vi.fn()
const load = vi.fn()

function modal(selectedRecord: GenerationRecord) {
  return (
    <HistoryModal
      record={selectedRecord}
      viewOrder={['a', 'b']}
      hasMore={false}
      isLoadingMore={false}
      onLoadMore={vi.fn()}
    />
  )
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
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
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('HistoryModal autoplay', () => {
  it('plays the record after the delay and the next player after a switch', async () => {
    useHistoryViewerStore.getState().open('a')

    const { rerender } = render(modal(record('a')))

    await advance(AUTOPLAY_DELAY_MS - 1)
    expect(play).not.toHaveBeenCalled()

    await advance(1)
    expect(play).toHaveBeenCalled()
    expect(screen.getByRole('dialog').querySelector('video')).not.toBeNull()
    expect(isActive('modal-a')).toBe(true)

    play.mockClear()
    fireEvent.keyDown(document.body, { key: 'ArrowRight' })

    rerender(modal(record('b')))

    await advance(AUTOPLAY_DELAY_MS)

    expect(isActive('modal-b')).toBe(true)
    expect(isActive('modal-a')).toBe(false)
    expect(play).toHaveBeenCalled()
  })
})

describe('HistoryTile autoplay', () => {
  it('keeps the poster only until hover', () => {
    const { container } = render(<HistoryTile record={record('tile')} onOpen={vi.fn()} />)

    expect(container.querySelector('video')).toBeNull()
    expect(play).not.toHaveBeenCalled()
  })
})
