'use client'

import { cn } from '@/lib/cn'

import type { CardAction } from '../actions/card-action'

interface DetailsActionIconButtonProps {
  action: CardAction
  onSelect: (action: CardAction) => void
}

/** Small square action button for a details footer. */
export function DetailsActionIconButton(props: DetailsActionIconButtonProps) {
  const { action } = props
  const Icon = action.icon

  const handleClick = () => {
    props.onSelect(action)
  }

  return (
    <button
      type="button"
      aria-label={action.label}
      onClick={handleClick}
      className={cn(
        'inline-flex h-6 w-7.5 items-center justify-center rounded-lg text-fg-2 transition hover:bg-hover',
        action.isActive === true && 'text-favorite',
      )}
    >
      <Icon size={14} className={cn(action.isActive === true && 'fill-current')} aria-hidden />
    </button>
  )
}
