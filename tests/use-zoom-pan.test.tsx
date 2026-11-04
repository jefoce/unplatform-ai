// @vitest-environment jsdom
import { type Dispatch, type SetStateAction, useRef } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { isFunction } from 'lodash-es'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useZoomPan } from '@/ui/use-zoom-pan'
import { clampOffset, type ZoomState, type ZoomView } from '@/ui/zoom-math'

const VIEW: ZoomView = {
  layerWidth: 800,
  layerHeight: 600,
  contentLeft: 100,
  contentTop: 75,
  contentWidth: 600,
  contentHeight: 450,
}

const START: ZoomState = { scale: 2, offset: { x: 0, y: 0 }, isAnimated: true }

interface PanHarnessProps {
  setZoom: Dispatch<SetStateAction<ZoomState>>
}

function PanHarness(props: PanHarnessProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  const pan = useZoomPan({
    view: VIEW,
    scale: START.scale,
    offset: START.offset,
    setZoom: props.setZoom,
    contentRef,
  })

  return (
    <div
      data-testid="pan"
      onPointerDown={pan.handlePointerDown}
      onPointerMove={pan.handlePointerMove}
      onPointerUp={pan.handlePointerUp}
    >
      <div ref={contentRef} />
    </div>
  )
}

afterEach(() => {
  cleanup()
})

describe('useZoomPan', () => {
  it('commits one clamped offset after ten drag moves', () => {
    const setZoom = vi.fn<Dispatch<SetStateAction<ZoomState>>>()

    render(<PanHarness setZoom={setZoom} />)

    const root = screen.getByTestId('pan')

    Object.assign(root, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() })
    fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX: 400, clientY: 300 })

    for (let step = 1; step <= 10; step += 1) {
      fireEvent.pointerMove(root, {
        pointerId: 1,
        clientX: 400 + step * 100,
        clientY: 300 + step * 50,
      })
    }

    expect(setZoom).not.toHaveBeenCalled()

    fireEvent.pointerUp(root, { pointerId: 1 })

    expect(setZoom).toHaveBeenCalledTimes(1)

    const [call] = setZoom.mock.calls

    if (call === undefined) {
      throw new Error('Expected a setZoom call')
    }

    const [update] = call

    if (!isFunction(update)) {
      throw new Error('Expected a state updater')
    }

    const next = update(START)
    const expected = clampOffset({ view: VIEW, scale: START.scale, offset: { x: 1000, y: 500 } })

    expect(next.offset).toEqual(expected)
    expect(next.isAnimated).toBe(false)
  })
})
