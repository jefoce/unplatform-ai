'use client'

import { createPortal } from 'react-dom'

interface WindowDropOverlayProps {
  isDragging: boolean
  hint: string
}

/** Full-window drop target, shown while files are dragged over the app. */
export function WindowDropOverlay(props: WindowDropOverlayProps) {
  const { isDragging, hint } = props

  if (!isDragging || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      aria-hidden
      className="pointer-events-auto fixed inset-0 flex flex-col items-center justify-center gap-2 border-4 border-dashed border-lime/60 bg-page/80 text-center"
      style={{ zIndex: 'var(--z-drop)' }}
    >
      <span className="text-base font-medium text-fg">Drop to add</span>
      <span className="text-sm font-medium text-fg-2">{hint}</span>
    </div>,
    document.body,
  )
}
