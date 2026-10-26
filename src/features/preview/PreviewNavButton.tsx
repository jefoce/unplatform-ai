'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/cn'

interface PreviewNavButtonProps {
  side: 'left' | 'right'
  disabled: boolean
  onClick: () => void
}

/** Round previous/next control on the preview stage. */
export function PreviewNavButton(props: PreviewNavButtonProps) {
  const { side, disabled: isDisabled } = props
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  const isLeft = side === 'left'
  const label = isLeft ? 'Previous media' : 'Next media'

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={props.onClick}
      aria-label={label}
      className={cn(
        'absolute top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-fg backdrop-blur-sm transition hover:bg-black/80 disabled:opacity-30',
        isLeft && 'left-4',
        !isLeft && 'right-4',
      )}
    >
      <Icon size={20} aria-hidden />
    </button>
  )
}
