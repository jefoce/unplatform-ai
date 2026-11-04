'use client'

import { useMemo } from 'react'

import type { HistoryItem } from '@/lib/feed/output-items'

const itemKey = (item: HistoryItem): string => {
  return [
    item.id,
    item.status,
    item.width ?? '',
    item.height ?? '',
    item.thumbSrc,
    String(item.favorite),
    String(item.canSelect),
    item.source.updatedAt,
  ].join(':')
}

/** Reuses the previous array while every item keeps the same layout values. */
export function useStableItems(items: HistoryItem[]): HistoryItem[] {
  const key = items.map(itemKey).join('|')

  const cached = useMemo(() => {
    return { key, items }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps -- key covers id, status, aspect, thumb, favorite, canSelect and updatedAt

  return cached.items
}
