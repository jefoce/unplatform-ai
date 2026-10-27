// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LazyVideo } from '@/features/player/LazyVideo'

const play = vi.fn(() => {
  return Promise.resolve()
})

const pause = vi.fn()
const load = vi.fn()

class Observer {
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', Observer)
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pause })
  Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: load })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  play.mockClear()
  pause.mockClear()
})

describe('LazyVideo hoverPlay', () => {
  it('pauses on leave, keeps the slot, and resumes on the next hover', () => {
    const { container } = render(<LazyVideo id="hover-1" src="/a.mp4" poster="/a.jpg" hoverPlay />)
    const root = container.firstElementChild as HTMLElement

    fireEvent.pointerOver(root)
    const video = container.querySelector('video')
    const posterOverlay = container.querySelector('img')

    expect(video).not.toBeNull()
    expect(video?.muted).toBe(true)
    expect(video?.loop).toBe(true)
    expect(video?.classList.contains('rounded-[inherit]')).toBe(true)
    expect(posterOverlay?.classList.contains('rounded-[inherit]')).toBe(true)
    expect(play).toHaveBeenCalled()

    fireEvent.pointerOut(root)
    expect(pause).toHaveBeenCalled()
    expect(container.querySelector('video')).toBe(video)

    play.mockClear()
    fireEvent.pointerOver(root)
    expect(play).toHaveBeenCalled()
  })

  it('loops a non-hover player until paused', () => {
    const { container, getByLabelText } = render(
      <LazyVideo id="inline-1" src="/a.mp4" poster="/a.jpg" />,
    )

    fireEvent.click(getByLabelText('Play video'))
    const video = container.querySelector('video')

    expect(video).not.toBeNull()
    expect(video?.loop).toBe(true)
    expect(video?.muted).toBe(false)
  })
})
