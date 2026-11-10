// @vitest-environment jsdom
import { useRef } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MEDIA_WIDTH_RETRY_FRAMES } from '@/core/constants'
import { useMediaWidth } from '@/lib/use-media-width'

import { required } from './helpers/required'

type FrameCallback = FrameRequestCallback

interface PendingFrame {
  id: number
  callback: FrameCallback
}

class WidthObserver {
  static callback: ResizeObserverCallback | null = null

  constructor(callback: ResizeObserverCallback) {
    WidthObserver.callback = callback
  }

  observe(): void {}

  disconnect(): void {}
}

let rectWidth = 0
let pending: PendingFrame[] = []
let frameCount = 0

function rect(width: number): DOMRect {
  return {
    x: 0,
    y: 0,
    width,
    height: 0,
    top: 0,
    right: width,
    bottom: 0,
    left: 0,
    toJSON: () => {
      return {}
    },
  }
}

function Probe() {
  const ref = useRef<HTMLDivElement>(null)
  const width = useMediaWidth(ref)

  return <div ref={ref} data-width={width} />
}

function probeWidth(container: HTMLElement): string | null {
  return required(container.firstElementChild, 'probe').getAttribute('data-width')
}

function runFrames(): void {
  act(() => {
    while (pending.length > 0) {
      const next = pending.shift()

      next?.callback(0)
    }
  })
}

function runNextFrame(): void {
  act(() => {
    const next = pending.shift()

    next?.callback(0)
  })
}

beforeEach(() => {
  rectWidth = 0
  pending = []
  frameCount = 0

  vi.stubGlobal('ResizeObserver', WidthObserver)

  vi.stubGlobal('requestAnimationFrame', (callback: FrameCallback) => {
    frameCount += 1
    pending.push({ id: frameCount, callback })

    return frameCount
  })

  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    pending = pending.filter((frame) => {
      return frame.id !== id
    })
  })

  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => {
    return rect(rectWidth)
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useMediaWidth', () => {
  it('retries a zero measurement on the next animation frame', () => {
    const { container } = render(<Probe />)

    expect(probeWidth(container)).toBe('0')

    rectWidth = 800
    runNextFrame()

    expect(probeWidth(container)).toBe('800')
  })

  it('stops after the retry frame cap while the width stays zero', () => {
    const { container } = render(<Probe />)

    runFrames()

    expect(frameCount).toBe(MEDIA_WIDTH_RETRY_FRAMES)
    expect(pending).toHaveLength(0)
    expect(probeWidth(container)).toBe('0')
  })

  it('restarts the retries when a resize still reports zero', () => {
    const { container } = render(<Probe />)

    runFrames()

    expect(frameCount).toBe(MEDIA_WIDTH_RETRY_FRAMES)

    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    expect(frameCount).toBe(MEDIA_WIDTH_RETRY_FRAMES + 1)

    rectWidth = 720
    runNextFrame()

    expect(probeWidth(container)).toBe('720')
  })

  it('sets a non-zero width without scheduling frames', () => {
    rectWidth = 640

    const { container } = render(<Probe />)

    expect(probeWidth(container)).toBe('640')
    expect(frameCount).toBe(0)
    expect(pending).toHaveLength(0)
  })

  it('ignores a zero width from the resize observer', () => {
    rectWidth = 600
    const { container } = render(<Probe />)

    expect(probeWidth(container)).toBe('600')

    act(() => {
      WidthObserver.callback?.(
        [{ contentRect: { width: 0 } } as ResizeObserverEntry],
        undefined as unknown as ResizeObserver,
      )
    })

    expect(probeWidth(container)).toBe('600')
  })
})
