'use client'

import { useMemo } from 'react'

import type { ImageListResult } from '@/core/api/image'
import { HISTORY_POLL_MS } from '@/core/constants'
import { type ImageRecord, isImageActive } from '@/core/schemas/image-record'
import { useStableItems } from '@/features/history/list/use-stable-items'
import { useWorkspaceTab } from '@/features/shared/use-workspace-tab'
import { type HistoryItem, imageItems } from '@/lib/feed/output-items'
import { useImagePages } from '@/lib/use-image-pages'

import { useImageViewStore } from './image-view-store'

interface ImageWorkspaceItems {
  records: ImageRecord[]
  activeCount: number
  items: HistoryItem[]
  isLoading: boolean
  hasMore: boolean
  isLoadingMore: boolean
  error: unknown
  loadMore: () => void
  onRetry: () => Promise<unknown>
}

/** Polls while a loaded record is active or the server reports active work. */
export function imagePollInterval(pages: ImageListResult[] | undefined): number {
  const isActive =
    pages?.some((page) => {
      return page.items.some(isImageActive)
    }) === true

  const hasServerActive = (pages?.[0]?.activeCount ?? 0) > 0

  if (isActive || hasServerActive) {
    return HISTORY_POLL_MS
  }

  return 0
}

/** Image feed: pages until the cursor ends, polled while a record is active. */
export function useImageWorkspaceItems(): ImageWorkspaceItems {
  const tab = useWorkspaceTab()

  const filters = useImageViewStore((state) => {
    return state.filters
  })

  const {
    records,
    activeCount: serverActiveCount,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    mutate,
  } = useImagePages({
    filters,
    refreshInterval: imagePollInterval,
    isPaused: tab !== 'image',
  })

  const loadedItems = useMemo(() => {
    return records.flatMap((record) => {
      return imageItems(record, filters.favorite === true)
    })
  }, [filters.favorite, records])

  const items = useStableItems(loadedItems)

  const activeCount = Math.max(serverActiveCount, records.filter(isImageActive).length)

  return {
    records,
    activeCount,
    items,
    isLoading,
    hasMore,
    isLoadingMore,
    error,
    loadMore,
    onRetry: () => {
      return mutate()
    },
  }
}
