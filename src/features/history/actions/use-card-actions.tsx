'use client'

import { type ReactNode, useState } from 'react'
import { isNil } from 'lodash-es'

import type { CardAction, CardActionConfirm } from './card-action'
import { DeleteConfirm } from './DeleteConfirm'

interface CardActionsState {
  handleSelect: (action: CardAction) => void
  confirmDialog: ReactNode
}

/** Confirm state shared by the card stack and the details footer. */
export function useCardActions(onDeleted?: () => void): CardActionsState {
  const [pending, setPending] = useState<CardActionConfirm | null>(null)

  const handleSelect = (action: CardAction) => {
    if ('confirm' in action) {
      setPending(action.confirm)

      return
    }

    action.onSelect()
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setPending(null)
    }
  }

  const handleConfirm = async () => {
    if (isNil(pending)) {
      return
    }

    await pending.onConfirm()
  }

  let confirmDialog: ReactNode = null

  if (!isNil(pending)) {
    confirmDialog = (
      <DeleteConfirm
        open
        onOpenChange={handleOpenChange}
        label={pending.label}
        title={pending.title}
        description={pending.description}
        confirmLabel={pending.confirmLabel}
        isDanger={pending.isDanger}
        successMessage={pending.successMessage}
        onConfirm={handleConfirm}
        onDeleted={onDeleted}
      />
    )
  }

  return { handleSelect, confirmDialog }
}
