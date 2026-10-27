'use client'

import {
  type Dispatch,
  type MouseEvent,
  type PointerEvent,
  type SetStateAction,
  useRef,
  useState,
} from 'react'
import { isFunction, isNil } from 'lodash-es'

import {
  clampOffset,
  FIT_ZOOM,
  KEY_STEP,
  type ZoomOffset,
  type ZoomPoint,
  type ZoomState,
  zoomTo,
  type ZoomView,
} from './zoom-math'

interface UseZoomPanParams {
  view: ZoomView
  scale: number
  offset: ZoomOffset
  setZoom: Dispatch<SetStateAction<ZoomState>>
}

interface UseZoomControlsParams {
  view: ZoomView
  zoom: ZoomState
  maxScale: number
  setZoom: Dispatch<SetStateAction<ZoomState>>
}

interface DragState {
  pointerId: number
  startX: number
  startY: number
  offset: ZoomOffset
}

interface ClientPoint {
  clientX: number
  clientY: number
}

function layerPoint(layer: HTMLElement, point: ClientPoint): ZoomPoint {
  const rect = layer.getBoundingClientRect()

  return { x: point.clientX - rect.left, y: point.clientY - rect.top }
}

/** Pointer pan while zoomed, clamped to the content bounds. */
export function useZoomPan(params: UseZoomPanParams) {
  const { view, scale, offset, setZoom } = params
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<DragState | undefined>(undefined)

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const isControl = event.target instanceof Element && !isNil(event.target.closest('button'))

    if (scale <= 1 || event.button !== 0 || isControl) {
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offset,
    }

    setIsDragging(true)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current

    if (isNil(drag) || drag.pointerId !== event.pointerId) {
      return
    }

    const nextOffset = {
      x: drag.offset.x + event.clientX - drag.startX,
      y: drag.offset.y + event.clientY - drag.startY,
    }

    setZoom((current) => {
      return {
        ...current,
        isAnimated: false,
        offset: clampOffset({ view, scale: current.scale, offset: nextOffset }),
      }
    })
  }

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current

    if (isNil(drag) || drag.pointerId !== event.pointerId) {
      return
    }

    if (isFunction(event.currentTarget.releasePointerCapture)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    dragRef.current = undefined
    setIsDragging(false)
  }

  return {
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp: handlePointerEnd,
    handlePointerCancel: handlePointerEnd,
  }
}

/** Button, percent and double-click zoom actions for the layer. */
export function useZoomControls(params: UseZoomControlsParams) {
  const { view, zoom, maxScale, setZoom } = params

  const zoomStep = (step: number) => {
    const point = { x: view.layerWidth / 2, y: view.layerHeight / 2 }

    setZoom((current) => {
      return zoomTo({
        view,
        current,
        nextScale: current.scale * step,
        point,
        maxScale,
        isAnimated: true,
      })
    })
  }

  const handleZoomIn = () => {
    zoomStep(KEY_STEP)
  }

  const handleZoomOut = () => {
    zoomStep(1 / KEY_STEP)
  }

  const handleFit = () => {
    setZoom(FIT_ZOOM)
  }

  const handleDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const isControl = event.target instanceof Element && !isNil(event.target.closest('button'))

    if (isControl) {
      return
    }

    if (zoom.scale > 1) {
      setZoom(FIT_ZOOM)

      return
    }

    const point = layerPoint(event.currentTarget, event)

    setZoom(zoomTo({ view, current: FIT_ZOOM, nextScale: 2, point, maxScale, isAnimated: true }))
  }

  return { handleZoomIn, handleZoomOut, handleFit, handleDoubleClick }
}
