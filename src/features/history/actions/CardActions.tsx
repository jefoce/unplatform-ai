'use client'

import { type ReactNode } from 'react'

import { cn } from '@/lib/cn'

import type { CardAction } from './card-action'
import { CardActionButton } from './CardActionButton'
import { useCardActions } from './use-card-actions'

interface CardActionsProps {
  actions: readonly CardAction[]
  menu?: ReactNode
  className?: string
  isCompact?: boolean
}

/** Action stack shared by the list row, video tile and image tile. */
export function CardActions(props: CardActionsProps) {
  const { actions, menu, isCompact = false } = props
  const { handleSelect, confirmDialog } = useCardActions()
  const gapClass = isCompact ? 'gap-1' : 'gap-1.5'

  return (
    <>
      <div className={cn('absolute right-3 flex flex-col', gapClass, props.className)}>
        {actions.map((action) => {
          return (
            <CardActionButton
              key={action.key}
              action={action}
              onSelect={handleSelect}
              isCompact={isCompact}
            />
          )
        })}
        {menu}
      </div>
      {confirmDialog}
    </>
  )
}
