'use client'

import type { HistoryItem } from '@/lib/feed/output-items'

interface SelectedItemsResult {
  selectedItems: HistoryItem[]
  byId: Map<string, HistoryItem>
}

/** Selected items plus the id lookup the batch bar needs. */
export function useSelectedItems(
  items: HistoryItem[],
  ids: ReadonlySet<string>,
): SelectedItemsResult {
  const selectedItems = items.filter((item) => {
    return ids.has(item.id)
  })

  const byId = new Map(
    items.map((item) => {
      return [item.id, item]
    }),
  )

  return { selectedItems, byId }
}
