'use client'

import { type KeyboardEvent, type MouseEvent } from 'react'
import { Check } from 'lucide-react'

import { cn } from '@/lib/cn'

import { useSelectionItem } from './use-selection-item'

interface SelectionCheckboxProps {
  id: string
  className?: string
}

function handleStopPropagation(event: MouseEvent<HTMLSpanElement>): void {
  event.stopPropagation()
}

/** Inline checkbox for a card's media area. */
export function SelectionCheckbox(props: SelectionCheckboxProps) {
  const { id, className } = props

  const {
    selected: isSelected,
    selecting: isSelecting,
    selectable: canSelect,
    select,
  } = useSelectionItem(id)

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    select(event.shiftKey)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== ' ') {
      return
    }

    event.preventDefault()
    select(event.shiftKey)
  }

  if (!canSelect) {
    return null
  }

  return (
    <span
      onMouseDown={handleStopPropagation}
      className={cn(
        'absolute top-3 left-3 z-30 transition-opacity',
        isSelecting && 'opacity-100',
        !isSelecting &&
          'pointer-events-none opacity-0 group-hover/card:pointer-events-auto group-hover/card:opacity-100 group-has-[:focus-visible]/card:pointer-events-auto group-has-[:focus-visible]/card:opacity-100',
        className,
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={isSelected}
        aria-label="Select video"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex size-5 items-center justify-center rounded-md transition-colors',
          isSelected && 'border-[1.5px] border-white bg-white text-black',
          !isSelected && 'border-[1.5px] border-white/90 bg-black/20 hover:bg-black/40',
        )}
      >
        {isSelected && <Check size={12} strokeWidth={3} aria-hidden />}
      </button>
    </span>
  )
}
