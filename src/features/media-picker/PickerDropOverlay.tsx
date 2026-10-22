'use client'

interface PickerDropOverlayProps {
  isDragging: boolean
}

/** Drop target overlay while files are dragged over the picker. */
export function PickerDropOverlay(props: PickerDropOverlayProps) {
  const { isDragging } = props

  if (!isDragging) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-xl border-2 border-dashed border-lime bg-black/60 text-sm font-medium text-lime backdrop-blur-sm">
      Drop to upload
    </div>
  )
}
