// @vitest-environment jsdom
/* eslint-disable max-lines -- zoom layer cases stay in one suite */
import { useRef } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PreviewBody } from '@/features/preview/PreviewBody'
import { useChainKeys } from '@/lib/use-chain-keys'
import { ZoomLayer } from '@/ui/ZoomLayer'

import { upload } from './helpers/validation-fixtures'

let resizeCallbacks: ResizeObserverCallback[] = []

class ResizeObserverStub {
  constructor(callback: ResizeObserverCallback) {
    resizeCallbacks.push(callback)
  }

  observe() {}

  unobserve() {}

  disconnect() {}
}

class Observer {
  observe() {}

  unobserve() {}

  disconnect() {}
}

beforeEach(() => {
  resizeCallbacks = []
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  vi.stubGlobal('IntersectionObserver', Observer)
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

const handleNoop = () => {}

function renderLayer(resetKey = 'a') {
  return render(
    <div role="dialog">
      <ZoomLayer resetKey={resetKey}>
        <div data-testid="box" />
      </ZoomLayer>
    </div>,
  )
}

function boxOf(): HTMLElement {
  return screen.getByTestId('box')
}

function wrapperOf(box: HTMLElement): HTMLElement {
  const wrapper = box.parentElement

  if (!wrapper) {
    throw new Error('Zoom wrapper not rendered')
  }

  return wrapper
}

function rootOf(box: HTMLElement): HTMLElement {
  const root = wrapperOf(box).parentElement

  if (!root) {
    throw new Error('Zoom layer not rendered')
  }

  return root
}

function percent(): string {
  return screen.getByText(/^\d+%$/).textContent ?? ''
}

function defineSize(node: HTMLElement, key: string, value: number): void {
  Object.defineProperty(node, key, { configurable: true, value })
}

/** Layer 800x600 with a 400x300 content box at 200/150, matching the math tests. */
function sizeLayer(box: HTMLElement): void {
  const root = rootOf(box)

  defineSize(root, 'offsetWidth', 800)
  defineSize(root, 'offsetHeight', 600)
  defineSize(box, 'offsetLeft', 200)
  defineSize(box, 'offsetTop', 150)
  defineSize(box, 'offsetWidth', 400)
  defineSize(box, 'offsetHeight', 300)
}

/** Layer 800x600 with a 600x450 content box, so 2x leaves room to pan. */
function sizeBigLayer(box: HTMLElement): void {
  const root = rootOf(box)

  defineSize(root, 'offsetWidth', 800)
  defineSize(root, 'offsetHeight', 600)
  defineSize(box, 'offsetLeft', 100)
  defineSize(box, 'offsetTop', 75)
  defineSize(box, 'offsetWidth', 600)
  defineSize(box, 'offsetHeight', 450)
}

function resize(): void {
  act(() => {
    for (const callback of resizeCallbacks) {
      callback([], {} as ResizeObserver)
    }
  })
}

function stubPointerCapture(node: HTMLElement): void {
  Object.assign(node, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() })
}

interface HarnessProps {
  onNext: () => void
}

/** Layer inside a chain-keys scope, so arrow navigation keeps working while zoomed. */
function Harness(props: HarnessProps) {
  const scopeRef = useRef<HTMLDivElement>(null)

  useChainKeys({ isEnabled: true, onPrevious: handleNoop, onNext: props.onNext, scopeRef })

  return (
    <div role="dialog">
      <div ref={scopeRef}>
        <ZoomLayer resetKey="arrows">
          <div data-testid="box" />
        </ZoomLayer>
      </div>
    </div>
  )
}

describe('ZoomLayer wheel and double click', () => {
  it('zooms with the wheel and updates the percent', () => {
    renderLayer()

    expect(percent()).toBe('100%')

    fireEvent.wheel(rootOf(boxOf()), { deltaY: -100, clientX: 0, clientY: 0 })

    expect(percent()).toBe('110%')
  })

  it('toggles between fit and 2x on double click', () => {
    renderLayer()
    const root = rootOf(boxOf())

    fireEvent.doubleClick(root, { clientX: 400, clientY: 300 })
    expect(percent()).toBe('200%')

    fireEvent.doubleClick(root, { clientX: 100, clientY: 100 })
    expect(percent()).toBe('100%')
  })
})

describe('ZoomLayer drag', () => {
  it('cancels a native drag that starts on an image inside it', () => {
    render(
      <div role="dialog">
        <ZoomLayer resetKey="drag">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny inline test image */}
          <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="" data-testid="photo" />
        </ZoomLayer>
      </div>,
    )

    expect(fireEvent.dragStart(screen.getByTestId('photo'))).toBe(false)
  })
})

describe('ZoomLayer controls', () => {
  it('changes the scale from the buttons and fits from the percent', () => {
    renderLayer()

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(percent()).toBe('150%')

    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect(percent()).toBe('100%')

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(percent()).toBe('225%')

    fireEvent.click(screen.getByRole('button', { name: '225%' }))
    expect(percent()).toBe('100%')
  })

  it('resets with 0 and ignores modified keys', () => {
    renderLayer()

    fireEvent.keyDown(document.body, { key: '+' })
    expect(percent()).toBe('150%')

    fireEvent.keyDown(document.body, { key: '-' })
    expect(percent()).toBe('100%')

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    fireEvent.keyDown(document.body, { key: '0' })
    expect(percent()).toBe('100%')

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    fireEvent.keyDown(document.body, { key: '0', ctrlKey: true })
    expect(percent()).toBe('150%')
  })
})

describe('ZoomLayer animation and cursor', () => {
  it('drops the transition during a drag and restores it on a button zoom', () => {
    renderLayer()
    const box = boxOf()
    const root = rootOf(box)

    sizeLayer(box)
    resize()
    stubPointerCapture(root)

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))

    const wrapper = wrapperOf(box)

    expect(wrapper.classList.contains('transition-transform')).toBe(true)

    fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX: 400, clientY: 300 })
    fireEvent.pointerMove(root, { pointerId: 1, clientX: 450, clientY: 330 })
    expect(wrapper.classList.contains('transition-transform')).toBe(false)

    fireEvent.pointerUp(root, { pointerId: 1, clientX: 450, clientY: 330 })
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(wrapper.classList.contains('transition-transform')).toBe(true)
  })

  it('ignores a double click on the Zoom in button', () => {
    renderLayer()

    const zoomIn = screen.getByRole('button', { name: 'Zoom in' })

    fireEvent.click(zoomIn)
    fireEvent.click(zoomIn)

    const before = percent()

    fireEvent.doubleClick(zoomIn)

    expect(before).toBe('225%')
    expect(percent()).toBe(before)
  })

  it('shows the grab cursor only while zoomed', () => {
    renderLayer()

    const root = rootOf(boxOf())

    expect(root.classList.contains('cursor-grab')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))

    expect(root.classList.contains('cursor-grab')).toBe(true)
  })
})

describe('ZoomLayer pan', () => {
  it('moves only while zoomed and clamps at the edge', () => {
    renderLayer()
    const box = boxOf()
    const root = rootOf(box)

    sizeLayer(box)
    resize()
    stubPointerCapture(root)

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(percent()).toBe('225%')

    fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX: 400, clientY: 300 })
    fireEvent.pointerMove(root, { pointerId: 1, clientX: 450, clientY: 330 })
    fireEvent.pointerUp(root, { pointerId: 1, clientX: 450, clientY: 330 })

    expect(wrapperOf(box).style.transform).toBe('translate(-200px, -157.5px) scale(2.25)')

    fireEvent.pointerDown(root, { button: 0, pointerId: 2, clientX: 400, clientY: 300 })
    fireEvent.pointerMove(root, { pointerId: 2, clientX: -2000, clientY: 300 })
    fireEvent.pointerUp(root, { pointerId: 2, clientX: -2000, clientY: 300 })

    expect(wrapperOf(box).style.transform).toBe('translate(-300px, -157.5px) scale(2.25)')

    fireEvent.keyDown(document.body, { key: '0' })
    fireEvent.pointerDown(root, { button: 0, pointerId: 3, clientX: 400, clientY: 300 })
    fireEvent.pointerMove(root, { pointerId: 3, clientX: 700, clientY: 500 })
    fireEvent.pointerUp(root, { pointerId: 3, clientX: 700, clientY: 500 })

    expect(wrapperOf(box).style.transform).toBe('translate(0px, 0px) scale(1)')
  })

  it('pans a photo after a double-click zoom to 2x', () => {
    renderLayer()
    const box = boxOf()
    const root = rootOf(box)

    sizeBigLayer(box)
    resize()
    stubPointerCapture(root)

    fireEvent.doubleClick(root, { clientX: 400, clientY: 300 })
    expect(percent()).toBe('200%')

    const wrapper = wrapperOf(box)
    const before = wrapper.style.transform

    fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX: 400, clientY: 300 })
    fireEvent.pointerMove(root, { pointerId: 1, clientX: 440, clientY: 320 })

    expect(wrapper.style.transform).not.toBe(before)
  })
})

describe('ZoomLayer reset and chain keys', () => {
  it('returns to fit when resetKey changes', () => {
    const { rerender } = renderLayer('a')

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(percent()).toBe('150%')

    rerender(
      <div role="dialog">
        <ZoomLayer resetKey="b">
          <div data-testid="box" />
        </ZoomLayer>
      </div>,
    )

    expect(percent()).toBe('100%')
  })

  it('lets ArrowRight reach the next handler while zoomed', () => {
    const onNext = vi.fn()

    render(<Harness onNext={onNext} />)
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    fireEvent.keyDown(document.body, { key: 'ArrowRight' })

    expect(onNext).toHaveBeenCalledTimes(1)
  })
})

describe('ZoomLayer clipping', () => {
  it('clips the zoomed content to the rounded layer', () => {
    renderLayer()

    const root = rootOf(boxOf())

    expect(root.classList.contains('rounded-xl')).toBe(true)
    expect(root.classList.contains('overflow-hidden')).toBe(true)
  })
})

describe('PreviewBody zoom scope', () => {
  it('shows zoom controls for a photo', () => {
    const item = upload('photo', 'image')

    render(<PreviewBody item={item} playerId="preview:photo" />)

    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeTruthy()
  })

  it('shows no zoom controls for a video', () => {
    const item = upload('clip', 'video')

    render(<PreviewBody item={item} playerId="preview:clip" />)

    expect(screen.queryByRole('button', { name: 'Zoom in' })).toBeNull()
  })
})
