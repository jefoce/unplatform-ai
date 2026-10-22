'use client'

import { useSelectionStore } from './selection-store'

/** Selection state and click handling for one card. */
export function useSelectionItem(id: string): {
  selected: boolean
  selecting: boolean
  selectable: boolean
  select: (shift: boolean) => void
} {
  const isSelected = useSelectionStore((state) => state.ids.has(id))
  const isSelecting = useSelectionStore((state) => state.ids.size > 0)
  const isSelectable = useSelectionStore((state) => state.order.includes(id))
  const toggle = useSelectionStore((state) => state.toggle)
  const selectRange = useSelectionStore((state) => state.selectRange)

  const select = (isShift: boolean) => {
    if (isShift) selectRange(id)
    else toggle(id)
  }

  return { selected: isSelected, selecting: isSelecting, selectable: isSelectable, select }
}
