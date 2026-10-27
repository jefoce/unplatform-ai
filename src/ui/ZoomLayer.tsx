'use client'

import {
  type Dispatch,
  type DragEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react'
import { isNil } from 'lodash-es'
import { Maximize2, Minus, Plus } from 'lucide-react'

import type { Dict } from '@/core/utility-types'
import { cn } from '@/lib/cn'
import { canHandleDialogKey } from '@/lib/dialog-keys'

import { useZoomControls, useZoomPan } from './use-zoom-pan'
import { EMPTY_VIEW, FIT_ZOOM, KEY_STEP, type ZoomState, zoomTo, type ZoomView } from './zoom-math'

interface ZoomLayerProps {
  children: ReactNode
  resetKey: string
  maxScale?: number
}

interface UseZoomInputParams {
  layerRef: RefObject<HTMLDivElement | null>
  view: ZoomView
  maxScale: number
  setZoom: Dispatch<SetStateAction<ZoomState>>
}

const WHEEL_STEP = 1.1
const PINCH_FACTOR = 0.01

const KEY_STEPS: Dict<number> = {
  '0': 0,
  '+': KEY_STEP,
  '=': KEY_STEP,
  '-': 1 / KEY_STEP,
}

const CONTROLS_CLASSES =
  'pointer-events-none absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-fg opacity-0 backdrop-blur-sm transition-opacity group-hover/zoom:pointer-events-auto group-hover/zoom:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:opacity-100'

const CONTROL_CLASSES =
  'flex size-8 items-center justify-center rounded-full text-fg tabular-nums transition hover:bg-white/10 focus-visible:bg-white/10'

function handleDragStart(event: DragEvent<HTMLDivElement>) {
  event.preventDefault()
}

function wheelFactor(event: WheelEvent): number {
  if (event.ctrlKey) {
    return Math.exp(-event.deltaY * PINCH_FACTOR)
  }

  if (event.deltaY < 0) {
    return WHEEL_STEP
  }

  return 1 / WHEEL_STEP
}

/** Layer refs plus the measured content box, refreshed when either side resizes. */
function useZoomView(resetKey: string) {
  const layerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<ZoomView>(EMPTY_VIEW)

  useEffect(() => {
    const layer = layerRef.current
    const content = contentRef.current?.firstElementChild

    if (isNil(layer) || !(content instanceof HTMLElement)) {
      return
    }

    const measure = () => {
      setView({
        layerWidth: layer.offsetWidth,
        layerHeight: layer.offsetHeight,
        contentLeft: content.offsetLeft,
        contentTop: content.offsetTop,
        contentWidth: content.offsetWidth,
        contentHeight: content.offsetHeight,
      })
    }

    measure()

    const observer = new ResizeObserver(() => {
      measure()
    })

    observer.observe(layer)
    observer.observe(content)

    return () => {
      observer.disconnect()
    }
  }, [resetKey])

  return { layerRef, contentRef, view }
}

function useZoomInput(params: UseZoomInputParams): void {
  const { layerRef, view, maxScale, setZoom } = params

  useEffect(() => {
    const layer = layerRef.current

    if (isNil(layer)) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()

      const rect = layer.getBoundingClientRect()
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }

      setZoom((current) => {
        const nextScale = current.scale * wheelFactor(event)

        return zoomTo({ view, current, nextScale, point, maxScale, isAnimated: false })
      })
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const step = KEY_STEPS[event.key]

      if (!canHandleDialogKey(event, layer) || isNil(step)) {
        return
      }

      event.preventDefault()

      if (step === 0) {
        setZoom(FIT_ZOOM)

        return
      }

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

    layer.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      layer.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [layerRef, maxScale, setZoom, view])
}

/** Optional zoom and pan for photo content, the rest of the stage stays put. */
export function ZoomLayer(props: ZoomLayerProps) {
  const { children, resetKey, maxScale = 8 } = props
  const { layerRef, contentRef, view } = useZoomView(resetKey)
  const [zoom, setZoom] = useState<ZoomState>(FIT_ZOOM)
  const [lastResetKey, setLastResetKey] = useState(resetKey)

  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey)
    setZoom(FIT_ZOOM)
  }

  useZoomInput({ layerRef, view, maxScale, setZoom })

  const pan = useZoomPan({ view, scale: zoom.scale, offset: zoom.offset, setZoom })
  const controls = useZoomControls({ view, zoom, maxScale, setZoom })

  const transform = `translate(${zoom.offset.x}px, ${zoom.offset.y}px) scale(${zoom.scale})`
  const transformOrigin = `${view.contentLeft}px ${view.contentTop}px`
  const percent = `${Math.round(zoom.scale * 100)}%`

  return (
    <div
      ref={layerRef}
      onDoubleClick={controls.handleDoubleClick}
      onPointerDown={pan.handlePointerDown}
      onPointerMove={pan.handlePointerMove}
      onPointerUp={pan.handlePointerUp}
      onPointerCancel={pan.handlePointerCancel}
      onDragStart={handleDragStart}
      className={cn(
        'group/zoom relative flex size-full touch-none items-center justify-center overflow-hidden rounded-xl select-none',
        zoom.scale > 1 && !pan.isDragging && 'cursor-grab',
        pan.isDragging && 'cursor-grabbing',
      )}
    >
      <div
        ref={contentRef}
        style={{ transform, transformOrigin, containerType: 'size' }}
        className={cn(
          'relative flex size-full items-center justify-center',
          zoom.isAnimated && 'transition-transform duration-150 motion-reduce:transition-none',
        )}
      >
        {children}
      </div>

      <div className={CONTROLS_CLASSES}>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={controls.handleZoomOut}
          className={CONTROL_CLASSES}
        >
          <Minus size={16} aria-hidden />
        </button>

        <button
          type="button"
          aria-live="polite"
          onClick={controls.handleFit}
          className={cn(CONTROL_CLASSES, 'w-auto px-2 text-xs font-semibold')}
        >
          {percent}
        </button>

        <button
          type="button"
          aria-label="Zoom in"
          onClick={controls.handleZoomIn}
          className={CONTROL_CLASSES}
        >
          <Plus size={16} aria-hidden />
        </button>

        <button
          type="button"
          aria-label="Fit to screen"
          onClick={controls.handleFit}
          className={CONTROL_CLASSES}
        >
          <Maximize2 size={16} aria-hidden />
        </button>
      </div>
    </div>
  )
}
