'use client'

import { useSelectionStore } from './selection-store'

interface UseSelectionItem {
  selected: boolean
  selecting: boolean
  selectable: boolean
  select: (shift: boolean) => void
}

/** Selection state and click handling for one card. */
export function useSelectionItem(id: string): UseSelectionItem {
  const isSelected = useSelectionStore((state) => {
    return state.ids.has(id)
  })

  const isSelecting = useSelectionStore((state) => {
    return state.ids.size > 0
  })

  const isSelectable = useSelectionStore((state) => {
    return state.order.includes(id)
  })

  const toggle = useSelectionStore((state) => {
    return state.toggle
  })

  const selectRange = useSelectionStore((state) => {
    return state.selectRange
  })

  const select = (isShift: boolean) => {
    if (isShift) {
      selectRange(id)
    } else {
      toggle(id)
    }
  }

  return { selected: isSelected, selecting: isSelecting, selectable: isSelectable, select }
}
