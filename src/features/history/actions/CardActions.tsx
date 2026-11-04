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
}

/** Action stack shared by the list row, video tile and image tile. */
export function CardActions(props: CardActionsProps) {
  const { actions, menu } = props
  const { handleSelect, confirmDialog } = useCardActions()

  return (
    <>
      <div className={cn('absolute right-3 flex flex-col gap-1.5', props.className)}>
        {actions.map((action) => {
          return <CardActionButton key={action.key} action={action} onSelect={handleSelect} />
        })}
        {menu}
      </div>
      {confirmDialog}
    </>
  )
}
