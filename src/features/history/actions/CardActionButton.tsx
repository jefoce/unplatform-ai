'use client'

import { type MouseEvent } from 'react'

import { cn } from '@/lib/cn'

import type { CardAction } from './card-action'
import {
  ACTIVE_BUTTON_CLASSES,
  COMPACT_ROUND_BUTTON_CLASSES,
  HOVER_REVEAL_CLASSES,
  ROUND_BUTTON_CLASSES,
} from './card-action-styles'

interface CardActionButtonProps {
  action: CardAction
  onSelect: (action: CardAction) => void
  isCompact?: boolean
}

/** One round action button, active when the action is a liked favorite. */
export function CardActionButton(props: CardActionButtonProps) {
  const { action, isCompact = false } = props
  const Icon = action.icon
  const isPinned = action.isPinned === true
  const buttonClass = isCompact ? COMPACT_ROUND_BUTTON_CLASSES : ROUND_BUTTON_CLASSES
  const iconSize = isCompact ? 14 : 15

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
        buttonClass,
        action.isActive === true && ACTIVE_BUTTON_CLASSES,
        !isPinned && HOVER_REVEAL_CLASSES,
      )}
    >
      <Icon
        size={iconSize}
        className={cn(action.isActive === true && 'fill-current')}
        aria-hidden
      />
    </button>
  )
}
