'use client'

import { type KeyboardEvent, type MouseEvent, useCallback } from 'react'

import type { GenerationRecord } from '@/core/types'
import { isOwnEvent } from '@/lib/events'

interface TileActivationParams {
  record: GenerationRecord
  isSelecting: boolean
  canSelect: boolean
  select: (isShift: boolean) => void
  onOpen: (record: GenerationRecord) => void
}

interface TileActivation {
  handleClick: (event: MouseEvent<HTMLDivElement>) => void
  handleKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
}

/** Click and keyboard activation shared by grid tiles. */
export function useTileActivation(params: TileActivationParams): TileActivation {
  const { record, isSelecting, canSelect, select, onOpen: handleOpen } = params

  const activate = useCallback(
    (isShift: boolean) => {
      if ((isShift || isSelecting) && !canSelect) return

      if (isShift || isSelecting) select(isShift)
      else handleOpen(record)
    },
    [canSelect, isSelecting, select, handleOpen, record],
  )

  const handleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!isOwnEvent(event)) return

      if ((event.target as HTMLElement).closest('button, a, input')) return

      activate(event.shiftKey)
    },
    [activate],
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!isOwnEvent(event)) return

      if (event.target !== event.currentTarget) return

      if (event.key !== 'Enter' && event.key !== ' ') return

      event.preventDefault()
      activate(event.shiftKey)
    },
    [activate],
  )

  return { handleClick, handleKeyDown }
}
