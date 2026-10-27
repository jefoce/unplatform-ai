// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AUTOPLAY_DELAY_MS } from '@/core/constants'
import { LazyVideo } from '@/features/player/LazyVideo'
import { getSnapshot, release } from '@/features/player/player-slots'
import { MediaPreviewModal } from '@/features/preview/MediaPreviewModal'
import { closePreview, openPreview } from '@/features/preview/preview-store'

import { upload } from './helpers/validation-fixtures'

const mocks = vi.hoisted(() => {
  return {
    playAudio: vi.fn<(src: string) => void>(),
    pauseAudio: vi.fn(),
    currentSrc: vi.fn<() => string>(),
    toastError: vi.fn(),
  }
})

let current = ''

vi.mock('@/lib/audio-player', () => {
  return {
    playAudio: mocks.playAudio,
    pauseAudio: mocks.pauseAudio,
    seekAudio: vi.fn(),
    currentSrc: mocks.currentSrc,
    currentDuration: () => {
      return 0
    },
    useAudioPlaying: () => {
      return false
    },
    useAudioTime: () => {
      return null
    },
  }
})

vi.mock('sonner', () => {
  return { toast: { success: vi.fn(), error: mocks.toastError } }
})

const play = vi.fn(() => {
  return Promise.resolve()
})

const pause = vi.fn()
const load = vi.fn()

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function renderModal(): void {
  render(<MediaPreviewModal />)
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  current = ''
  mocks.playAudio.mockReset()

  mocks.playAudio.mockImplementation((src) => {
    current = src
  })

  mocks.pauseAudio.mockReset()
  mocks.currentSrc.mockReset()

  mocks.currentSrc.mockImplementation(() => {
    return current
  })

  mocks.toastError.mockReset()
  vi.stubGlobal('IntersectionObserver', Observer)
  vi.stubGlobal('ResizeObserver', Observer)
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pause })
  Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: load })
})

afterEach(() => {
  cleanup()
  closePreview()
  document.body.replaceChildren()

  for (const id of getSnapshot()) {
    release(id)
  }

  play.mockClear()
  pause.mockClear()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('preview autoplay', () => {
  it('waits for the delay before playing a video item', async () => {
    renderModal()

    act(() => {
      openPreview({ items: [upload('clip', 'video')], index: 0 })
    })

    await advance(AUTOPLAY_DELAY_MS - 1)
    expect(play).not.toHaveBeenCalled()

    await advance(1)
    expect(play).toHaveBeenCalled()
    expect(screen.getByRole('dialog').querySelector('video')).not.toBeNull()
  })

  it('waits for the delay before playing an audio item and pauses it on a switch', async () => {
    renderModal()

    act(() => {
      openPreview({ items: [upload('track', 'audio'), upload('clip', 'video')], index: 0 })
    })

    expect(mocks.playAudio).not.toHaveBeenCalled()

    await advance(AUTOPLAY_DELAY_MS)
    expect(mocks.playAudio).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByLabelText('Next'))
    await advance(AUTOPLAY_DELAY_MS)

    expect(mocks.pauseAudio).toHaveBeenCalled()
    expect(play).toHaveBeenCalled()
  })

  it('pauses audio when the preview closes', async () => {
    renderModal()

    act(() => {
      openPreview({ items: [upload('track', 'audio')], index: 0 })
    })

    await advance(AUTOPLAY_DELAY_MS)
    expect(mocks.playAudio).toHaveBeenCalledTimes(1)

    act(() => {
      closePreview()
    })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mocks.pauseAudio).toHaveBeenCalled()
  })

  it('keeps the play button and shows no toast when autoplay is rejected', async () => {
    play.mockImplementationOnce(() => {
      return Promise.reject(new Error('blocked'))
    })

    const { container } = render(<LazyVideo id="rejected" src="/blocked.mp4" autoPlay />)

    await advance(AUTOPLAY_DELAY_MS)

    expect(play).toHaveBeenCalled()
    expect(container.querySelector('button[aria-label="Play"]')).not.toBeNull()
    expect(mocks.toastError).not.toHaveBeenCalled()
  })
})

describe('autoplay delay', () => {
  it('loads nothing when three quick switches end on the last item', async () => {
    const { rerender } = render(<LazyVideo id="clip-1" src="/1.mp4" autoPlay />)

    rerender(<LazyVideo id="clip-2" src="/2.mp4" autoPlay />)
    rerender(<LazyVideo id="clip-3" src="/3.mp4" autoPlay />)

    await advance(AUTOPLAY_DELAY_MS)

    expect(play).toHaveBeenCalledTimes(1)
    expect(getSnapshot()).toEqual(['clip-3'])
  })

  it('shows the poster overlay until the video fires playing', async () => {
    const { container } = render(
      <LazyVideo id="overlay" src="/clip.mp4" poster="/clip.jpg" autoPlay />,
    )

    await advance(AUTOPLAY_DELAY_MS)

    const video = container.querySelector('video')
    const poster = container.querySelector('img')

    expect(video).not.toBeNull()
    expect(poster).not.toBeNull()
    expect(poster?.className).not.toContain('opacity-0')

    fireEvent.playing(video as HTMLVideoElement)

    expect(poster?.className).toContain('opacity-0')
  })
})
