import { clamp } from 'lodash-es'

/** Translation of the content inside the zoom layer, in layer pixels. */
export interface ZoomOffset {
  x: number
  y: number
}

/** Point in layer coordinates. */
export interface ZoomPoint {
  x: number
  y: number
}

/** Layer and content boxes the zoom math works with, in unscaled pixels. */
export interface ZoomView {
  layerWidth: number
  layerHeight: number
  contentLeft: number
  contentTop: number
  contentWidth: number
  contentHeight: number
}

/** Scale, the content translation it applies and whether the change animates. */
export interface ZoomState {
  scale: number
  offset: ZoomOffset
  isAnimated: boolean
}

export const FIT_ZOOM: ZoomState = { scale: 1, offset: { x: 0, y: 0 }, isAnimated: true }

export const KEY_STEP = 1.5

export const EMPTY_VIEW: ZoomView = {
  layerWidth: 0,
  layerHeight: 0,
  contentLeft: 0,
  contentTop: 0,
  contentWidth: 0,
  contentHeight: 0,
}

interface ZoomAtPointParams {
  view: ZoomView
  currentScale: number
  nextScale: number
  currentOffset: ZoomOffset
  point: ZoomPoint
}

interface ClampOffsetParams {
  view: ZoomView
  scale: number
  offset: ZoomOffset
}

interface ZoomToParams {
  view: ZoomView
  current: ZoomState
  nextScale: number
  point: ZoomPoint
  maxScale: number
  isAnimated?: boolean
}

interface AxisParams {
  layerSize: number
  origin: number
  contentSize: number
  scale: number
  offset: number
}

const MIN_SCALE = 1

/** Keeps the scale at fit or above, never past the layer maximum. */
export function clampScale(scale: number, maxScale: number): number {
  return clamp(scale, MIN_SCALE, maxScale)
}

/** Offset that keeps the content point under the cursor at the next scale. */
export function zoomAtPoint(params: ZoomAtPointParams): ZoomOffset {
  const { view, currentScale, nextScale, currentOffset, point } = params
  const ratio = nextScale / currentScale
  const qx = point.x - view.contentLeft
  const qy = point.y - view.contentTop

  return {
    x: qx - (qx - currentOffset.x) * ratio,
    y: qy - (qy - currentOffset.y) * ratio,
  }
}

function clampAxis(params: AxisParams): number {
  const { layerSize, origin, contentSize, scale, offset } = params
  const scaled = contentSize * scale

  if (scaled <= layerSize) {
    return (layerSize - scaled) / 2 - origin
  }

  return clamp(offset, layerSize - origin - scaled, -origin)
}

/** Scale, cursor zoom and clamp in one step for the next scale. */
export function zoomTo(params: ZoomToParams): ZoomState {
  const { view, current, nextScale, point, maxScale, isAnimated = false } = params
  const scale = clampScale(nextScale, maxScale)

  const offset = clampOffset({
    view,
    scale,
    offset: zoomAtPoint({
      view,
      currentScale: current.scale,
      nextScale: scale,
      currentOffset: current.offset,
      point,
    }),
  })

  return { scale, offset, isAnimated }
}

/** Centers content smaller than the layer, keeps larger content inside it. */
export function clampOffset(params: ClampOffsetParams): ZoomOffset {
  const { view, scale, offset } = params

  return {
    x: clampAxis({
      layerSize: view.layerWidth,
      origin: view.contentLeft,
      contentSize: view.contentWidth,
      scale,
      offset: offset.x,
    }),
    y: clampAxis({
      layerSize: view.layerHeight,
      origin: view.contentTop,
      contentSize: view.contentHeight,
      scale,
      offset: offset.y,
    }),
  }
}
