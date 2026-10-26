'use client'

import { Minimize2 } from 'lucide-react'

import { ZOOM_DEFAULT, ZOOM_STEPS } from '@/core/constants'
import { Slider } from '@/ui/Slider'

import { useHistoryViewStore } from './view-store'

/** Six-step zoom for list height and grid tile width, persisted. */
export function ZoomSlider() {
  const zoom = useHistoryViewStore((state) => {
    return state.zoom
  })

  const setZoom = useHistoryViewStore((state) => {
    return state.setZoom
  })

  const handleReset = () => {
    setZoom(ZOOM_DEFAULT)
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Reset zoom"
        onClick={handleReset}
        className="inline-flex size-6 items-center justify-center rounded-md text-fg-2 transition hover:bg-hover hover:text-fg"
      >
        <Minimize2 size={14} aria-hidden />
      </button>
      <Slider
        ariaLabel="Zoom"
        min={0}
        max={ZOOM_STEPS - 1}
        step={1}
        value={zoom}
        onValueChange={setZoom}
        name="zoom"
        className="h-3 w-32 [&>span:first-child]:h-0.75"
      />
    </div>
  )
}
