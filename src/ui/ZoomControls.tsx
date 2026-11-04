'use client'

import { Maximize2, Minus, Plus } from 'lucide-react'

import { cn } from '@/lib/cn'

interface ZoomControlsProps {
  percent: string
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
}

const CONTROLS_CLASSES =
  'pointer-events-none absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-fg opacity-0 backdrop-blur-sm linux:bg-solid-overlay transition-opacity group-hover/zoom:pointer-events-auto group-hover/zoom:opacity-100 has-focus-visible:pointer-events-auto has-focus-visible:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:opacity-100'

const CONTROL_CLASSES =
  'flex size-8 items-center justify-center rounded-full text-fg tabular-nums transition hover:bg-white/10 focus-visible:bg-white/10'

/** Zoom buttons and the current percentage for a zoom layer. */
export function ZoomControls(props: ZoomControlsProps) {
  return (
    <div className={CONTROLS_CLASSES}>
      <button
        type="button"
        aria-label="Zoom out"
        onClick={props.onZoomOut}
        className={CONTROL_CLASSES}
      >
        <Minus size={16} aria-hidden />
      </button>

      <button
        type="button"
        aria-live="polite"
        onClick={props.onFit}
        className={cn(CONTROL_CLASSES, 'w-auto px-2 text-xs font-semibold')}
      >
        {props.percent}
      </button>

      <button
        type="button"
        aria-label="Zoom in"
        onClick={props.onZoomIn}
        className={CONTROL_CLASSES}
      >
        <Plus size={16} aria-hidden />
      </button>

      <button
        type="button"
        aria-label="Fit to screen"
        onClick={props.onFit}
        className={CONTROL_CLASSES}
      >
        <Maximize2 size={16} aria-hidden />
      </button>
    </div>
  )
}
