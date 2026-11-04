// @vitest-environment jsdom
import { type Dispatch, type SetStateAction, useRef } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useZoomInput } from '@/ui/use-zoom-layer'
import type { DragState } from '@/ui/use-zoom-pan'
import type { ZoomState, ZoomView } from '@/ui/zoom-math'

const VIEW: ZoomView = {
  layerWidth: 800,
  layerHeight: 600,
  contentLeft: 100,
  contentTop: 75,
  contentWidth: 600,
  contentHeight: 450,
}

const START: ZoomState = { scale: 1, offset: { x: 0, y: 0 }, isAnimated: true }

interface WheelHarnessProps {
  setZoom: Dispatch<SetStateAction<ZoomState>>
}

function WheelHarness(props: WheelHarnessProps) {
  const layerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | undefined>(undefined)

  useZoomInput({
    layerRef,
    contentRef,
    dragRef,
    view: VIEW,
    zoom: START,
    maxScale: 8,
    setZoom: props.setZoom,
  })

  return (
    <div ref={layerRef} data-testid="layer">
      <div ref={contentRef} />
    </div>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useZoomInput', () => {
  it('commits one zoom after ten wheel events go quiet', () => {
    const setZoom = vi.fn<Dispatch<SetStateAction<ZoomState>>>()

    render(<WheelHarness setZoom={setZoom} />)

    const layer = screen.getByTestId('layer')

    for (let step = 0; step < 10; step += 1) {
      fireEvent.wheel(layer, { deltaY: -100, clientX: 0, clientY: 0 })
    }

    expect(setZoom).not.toHaveBeenCalled()

    vi.advanceTimersByTime(120)

    expect(setZoom).toHaveBeenCalledTimes(1)
  })
})
