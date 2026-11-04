'use client'

import { createContext, useCallback, useContext, useEffect, useMemo } from 'react'
import { isNil } from 'lodash-es'
import useSWRInfinite from 'swr/infinite'

import type { GenerationListResult } from '@/core/api/video'
import { countActive } from '@/core/feed/history-filters'
import { isNonEmptyString } from '@/core/guards'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import { fetchGenerationPage, generationPageKey } from '@/lib/api/generations'
import { refreshHistoryFeeds, registerHistoryFeed } from '@/lib/history-feed-refresh'

import { loadedRecords } from './history-pages'
import { useHistoryPoll } from './use-history-poll'
import { useHistoryViewStore } from './view-store'

export interface HistoryResult {
  records: GenerationRecord[]
  activeCount: number
  nextCursor: string | null
  isLoading: boolean
  isValidating: boolean
  hasMore: boolean
  error: unknown
  loadMore: () => void
  retry: () => Promise<unknown>
  mutateHistory: () => Promise<unknown>
}

export const HistoryContext = createContext<HistoryResult | null>(null)

/** History feed shared by the watcher and the visible section. */
export function useHistoryFeed(): HistoryResult {
  const history = useContext(HistoryContext)

  if (isNil(history)) {
    throw new Error('HistorySection needs the JobWatcher provider')
  }

  return history
}

export function useHistory(): HistoryResult {
  const filters = useHistoryViewStore((state) => {
    return state.filters
  })

  const { data, error, isLoading, isValidating, size, setSize, mutate } =
    useSWRInfinite<GenerationListResult>(
      (index: number, previous: GenerationListResult | null) => {
        return generationPageKey({ filters, index, previous })
      },
      fetchGenerationPage,
      {
        keepPreviousData: true,
        revalidateOnFocus: true,
        refreshWhenHidden: true,
      },
    )

  useEffect(() => {
    return registerHistoryFeed(mutate)
  }, [mutate])

  const records = useMemo(() => {
    return loadedRecords(data)
  }, [data])

  // Local active records keep title and overlay honest when the server lags.
  const activeCount = Math.max(data?.[0]?.activeCount ?? 0, countActive(records))
  const nextCursor = data?.at(-1)?.nextCursor ?? null

  useHistoryPoll({ activeCount, records, mutate })

  const loadMore = useCallback(() => {
    if (!isNonEmptyString(nextCursor) || isValidating) {
      return
    }

    void setSize(size + 1)
  }, [isValidating, nextCursor, setSize, size])

  return {
    records,
    activeCount,
    nextCursor,
    isLoading,
    isValidating,
    hasMore: Boolean(nextCursor),
    error,
    loadMore,
    retry: () => {
      return mutate()
    },
    mutateHistory: refreshHistoryFeeds,
  }
}
