'use client'

import { type MouseEvent } from 'react'

import { cn } from '@/lib/cn'

import type { CardAction } from './card-action'
import {
  ACTIVE_BUTTON_CLASSES,
  HOVER_REVEAL_CLASSES,
  ROUND_BUTTON_CLASSES,
} from './card-action-styles'

interface CardActionButtonProps {
  action: CardAction
  onSelect: (action: CardAction) => void
}

/** One round action button, active when the action is a liked favorite. */
export function CardActionButton(props: CardActionButtonProps) {
  const { action } = props
  const Icon = action.icon
  const isPinned = action.isPinned === true

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    props.onSelect(action)
  }

  return (
    <button
      type="button"
      aria-label={action.label}
      onClick={handleClick}
      className={cn(
        ROUND_BUTTON_CLASSES,
        action.isActive === true && ACTIVE_BUTTON_CLASSES,
        !isPinned && HOVER_REVEAL_CLASSES,
      )}
    >
      <Icon size={15} className={cn(action.isActive === true && 'fill-current')} aria-hidden />
    </button>
  )
}
