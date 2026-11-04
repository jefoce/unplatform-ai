'use client'

import { useEffect, useMemo } from 'react'

import type { HistoryItem } from '@/lib/feed/output-items'

import { useSelectionStore } from './selection-store'

/** Keeps the selection order and prunes ids that left the visible items. */
export function useSelectionSync(items: HistoryItem[]): void {
  const order = useMemo(() => {
    return items
      .filter((item) => {
        return item.canSelect
      })
      .map((item) => {
        return item.id
      })
  }, [items])

  const viewOrder = useMemo(() => {
    return items.map((item) => {
      return item.id
    })
  }, [items])

  useEffect(() => {
    useSelectionStore.getState().setOrder(order)
  }, [order])

  useEffect(() => {
    useSelectionStore.getState().prune(new Set(viewOrder))
  }, [viewOrder])
}
