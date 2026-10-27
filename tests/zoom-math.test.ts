import { describe, expect, it } from 'vitest'

import {
  clampOffset,
  clampScale,
  FIT_ZOOM,
  zoomAtPoint,
  type ZoomOffset,
  zoomTo,
  type ZoomView,
} from '@/ui/zoom-math'

const VIEW: ZoomView = {
  layerWidth: 800,
  layerHeight: 600,
  contentLeft: 200,
  contentTop: 150,
  contentWidth: 400,
  contentHeight: 300,
}

const SMALL_VIEW: ZoomView = {
  layerWidth: 800,
  layerHeight: 600,
  contentLeft: 300,
  contentTop: 250,
  contentWidth: 200,
  contentHeight: 100,
}

/** Screen position of a content point after an offset at a scale. */
function screenPoint(view: ZoomView, offset: ZoomOffset, scale: number): ZoomOffset {
  return {
    x: view.contentLeft + offset.x + 200 * scale,
    y: view.contentTop + offset.y + 150 * scale,
  }
}

describe('zoomAtPoint', () => {
  it('keeps the content point under the cursor', () => {
    const offset = zoomAtPoint({
      view: VIEW,
      currentScale: 1,
      nextScale: 2,
      currentOffset: { x: 0, y: 0 },
      point: { x: 400, y: 300 },
    })

    expect(offset).toEqual({ x: -200, y: -150 })
    expect(screenPoint(VIEW, offset, 2)).toEqual({ x: 400, y: 300 })
  })
})

describe('clampOffset', () => {
  it('keeps the scaled content inside the layer', () => {
    const offset = clampOffset({ view: VIEW, scale: 3, offset: { x: -900, y: 0 } })

    expect(offset).toEqual({ x: -600, y: -150 })
  })

  it('centers content smaller than the layer', () => {
    const offset = clampOffset({ view: SMALL_VIEW, scale: 2, offset: { x: 999, y: -999 } })

    expect(offset).toEqual({ x: -100, y: -50 })
  })
})

describe('clampScale', () => {
  it('stays between fit and the maximum', () => {
    expect(clampScale(0.5, 8)).toBe(1)
    expect(clampScale(3, 8)).toBe(3)
    expect(clampScale(12, 8)).toBe(8)
  })
})

describe('zoomTo', () => {
  it('stores the animation flag', () => {
    const state = zoomTo({
      view: VIEW,
      current: FIT_ZOOM,
      nextScale: 2,
      point: { x: 400, y: 300 },
      maxScale: 8,
      isAnimated: false,
    })

    expect(state).toMatchObject({ scale: 2, isAnimated: false })
  })
})
