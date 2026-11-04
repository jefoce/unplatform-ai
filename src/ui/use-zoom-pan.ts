'use client'

import {
  type Dispatch,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react'
import { isFunction, isNil } from 'lodash-es'

import { cancelFrame } from './zoom-frame'
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
  contentRef: RefObject<HTMLDivElement | null>
}

interface UseZoomControlsParams {
  view: ZoomView
  zoom: ZoomState
  maxScale: number
  setZoom: Dispatch<SetStateAction<ZoomState>>
}

export interface DragState {
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

interface PaintOffsetParams {
  contentRef: RefObject<HTMLDivElement | null>
  view: ZoomView
  scale: number
  offset: ZoomOffset
}

/** Sets or clears the compositing hint on the content layer. */
function syncWillChange(contentRef: RefObject<HTMLDivElement | null>, isZoomed: boolean): void {
  if (isNil(contentRef.current)) {
    return
  }

  const value = isZoomed ? 'transform' : ''

  contentRef.current.style.willChange = value
}

/** Paints the pan transform without a React commit, on the GPU layer. */
export function paintOffset(params: PaintOffsetParams): void {
  const { contentRef, view, scale, offset } = params
  const element = contentRef.current

  if (isNil(element)) {
    return
  }

  const clamped = clampOffset({ view, scale, offset })

  element.style.transform = `translate3d(${clamped.x}px, ${clamped.y}px, 0) scale(${scale})`
}

/** Pointer pan while zoomed, clamped to the content bounds. */
export function useZoomPan(params: UseZoomPanParams) {
  const { view, scale, offset, setZoom, contentRef } = params
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<DragState | undefined>(undefined)
  const latestRef = useRef<ZoomOffset | undefined>(undefined)
  const frameRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    return () => {
      cancelFrame(frameRef)
    }
  }, [])

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const isControl = event.target instanceof Element && !isNil(event.target.closest('button'))

    if (scale <= 1 || event.button !== 0 || isControl) {
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)

    syncWillChange(contentRef, true)

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offset,
    }

    latestRef.current = undefined

    setIsDragging(true)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current

    if (isNil(drag) || drag.pointerId !== event.pointerId) {
      return
    }

    latestRef.current = {
      x: drag.offset.x + event.clientX - drag.startX,
      y: drag.offset.y + event.clientY - drag.startY,
    }

    if (!isNil(frameRef.current)) {
      return
    }

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = undefined
      const latest = latestRef.current

      if (!isNil(latest)) {
        paintOffset({ contentRef, view, scale, offset: latest })
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

    cancelFrame(frameRef)

    const latest = latestRef.current

    latestRef.current = undefined

    if (!isNil(latest)) {
      setZoom((current) => {
        return {
          ...current,
          isAnimated: false,
          offset: clampOffset({ view, scale: current.scale, offset: latest }),
        }
      })
    }

    setIsDragging(false)
    syncWillChange(contentRef, scale > 1)
  }

  return {
    isDragging,
    dragRef,
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
