'use client'

import { type KeyboardEvent, type MouseEvent, useCallback } from 'react'

import { isOwnEvent } from '@/lib/events'
import type { HistoryItem } from '@/lib/feed/output-items'

interface TileActivationParams {
  item: HistoryItem
  isSelecting: boolean
  canSelect: boolean
  isDisabled: boolean
  select: (isShift: boolean) => void
  onOpen: (item: HistoryItem) => void
}

interface TileActivation {
  handleClick: (event: MouseEvent<HTMLDivElement>) => void
  handleKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
}

/** Click and keyboard activation shared by grid tiles. */
export function useTileActivation(params: TileActivationParams): TileActivation {
  const { item, isSelecting, canSelect, isDisabled, select, onOpen: handleOpen } = params

  const activate = useCallback(
    (isShift: boolean) => {
      if (isDisabled) {
        return
      }

      if ((isShift || isSelecting) && !canSelect) {
        return
      }

      if (isShift || isSelecting) {
        select(isShift)
      } else {
        handleOpen(item)
      }
    },
    [canSelect, isDisabled, isSelecting, select, handleOpen, item],
  )

  const handleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!isOwnEvent(event)) {
        return
      }

      if ((event.target as HTMLElement).closest('button, a, input')) {
        return
      }

      activate(event.shiftKey)
    },
    [activate],
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!isOwnEvent(event)) {
        return
      }

      if (event.target !== event.currentTarget) {
        return
      }

      if (event.key !== 'Enter' && event.key !== ' ') {
        return
      }

      event.preventDefault()
      activate(event.shiftKey)
    },
    [activate],
  )

  return { handleClick, handleKeyDown }
}
