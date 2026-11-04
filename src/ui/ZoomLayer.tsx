'use client'

import { type DragEvent, type ReactNode, useState } from 'react'

import { cn } from '@/lib/cn'

import { useZoomInput, useZoomRenderCount, useZoomView } from './use-zoom-layer'
import { useZoomControls, useZoomPan } from './use-zoom-pan'
import { FIT_ZOOM, type ZoomState } from './zoom-math'
import { ZoomControls } from './ZoomControls'

interface ZoomLayerProps {
  children: ReactNode
  resetKey: string
  maxScale?: number
}

function handleDragStart(event: DragEvent<HTMLDivElement>) {
  event.preventDefault()
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

  const pan = useZoomPan({ view, scale: zoom.scale, offset: zoom.offset, setZoom, contentRef })

  useZoomInput({ contentRef, dragRef: pan.dragRef, layerRef, view, zoom, maxScale, setZoom })
  useZoomRenderCount()

  const controls = useZoomControls({ view, zoom, maxScale, setZoom })

  const transform = `translate3d(${zoom.offset.x}px, ${zoom.offset.y}px, 0) scale(${zoom.scale})`
  const percent = `${Math.round(zoom.scale * 100)}%`
  const willChange = zoom.scale > 1 ? 'transform' : undefined

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
        style={{
          transform,
          transformOrigin: `${view.contentLeft}px ${view.contentTop}px`,
          willChange,
        }}
        className={cn(
          'relative flex size-full items-center justify-center',
          zoom.isAnimated && !pan.isDragging && 'transition-transform duration-150',
        )}
      >
        {children}
      </div>

      <ZoomControls
        percent={percent}
        onZoomIn={controls.handleZoomIn}
        onZoomOut={controls.handleZoomOut}
        onFit={controls.handleFit}
      />
    </div>
  )
}
