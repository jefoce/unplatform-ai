// @vitest-environment jsdom
import { useRef } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useMediaWidth } from '@/lib/use-media-width'

import { required } from './helpers/required'

type FrameCallback = FrameRequestCallback

class WidthObserver {
  static callback: ResizeObserverCallback | null = null

  constructor(callback: ResizeObserverCallback) {
    WidthObserver.callback = callback
  }

  observe(): void {}

  disconnect(): void {}
}

let rectWidth = 0
let frame: FrameCallback | null = null

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

beforeEach(() => {
  rectWidth = 0
  frame = null

  vi.stubGlobal('ResizeObserver', WidthObserver)

  vi.stubGlobal('requestAnimationFrame', (callback: FrameCallback) => {
    frame = callback

    return 1
  })

  vi.stubGlobal('cancelAnimationFrame', () => {})

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

    act(() => {
      frame?.(0)
    })

    expect(probeWidth(container)).toBe('800')
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
