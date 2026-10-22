'use client'

import { type MouseEvent, useCallback } from 'react'
import { X } from 'lucide-react'

import { currentSrc, pauseAudio } from '@/lib/audio-player'
import { cn } from '@/lib/cn'

interface ReferenceRemoveButtonProps {
  label: string
  audioSrc: string
  isAudio: boolean
  overlayClass: string
  onRemove: () => void
}

/** Remove control for a reference tile, pausing its audio when playing. */
export function ReferenceRemoveButton(props: ReferenceRemoveButtonProps) {
  const { label, audioSrc, isAudio, overlayClass, onRemove } = props
  const handleRemoveClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>): void => {
      event.stopPropagation()

      if (isAudio && currentSrc() === audioSrc) pauseAudio()

      onRemove()
    },
    [isAudio, audioSrc, onRemove],
  )

  return (
    <button
      type="button"
      onClick={handleRemoveClick}
      aria-label={`Remove ${label}`}
      className={cn(
        'absolute -top-2 -right-2 z-20 size-4 items-center justify-center rounded-md border border-line bg-white/5 text-fg backdrop-blur-sm',
        overlayClass,
      )}
    >
      <X size={8} />
    </button>
  )
}
