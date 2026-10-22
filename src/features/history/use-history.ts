'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { isNil } from 'lodash-es'
import useSWRInfinite from 'swr/infinite'

import { HISTORY_PAGE_SIZE } from '@/core/constants'
import { countActive } from '@/core/history-filters'
import type { GenerationListResult, GenerationRecord } from '@/core/types'
import { fetcher } from '@/lib/fetcher'
import { registerHistoryRefresh } from '@/lib/swr-keys'

import { loadedRecords, revalidateHistory } from './history-pages'
import { useHistoryPoll } from './use-history-poll'
import { FILTER_PARAMS, useHistoryViewStore, type ViewFilters } from './view-store'

export { revalidateHistory } from './history-pages'

function historyKey(filters: ViewFilters): string {
  const params = new URLSearchParams({ limit: String(HISTORY_PAGE_SIZE) })
  const query = filters.q?.trim()

  if (!isNil(query) && query !== '') params.set('q', query)
  if (filters.favorite === true) params.set('favorite', '1')

  for (const [key, fallback] of FILTER_PARAMS) {
    const value = filters[key]

    if (!isNil(value) && value !== '' && value !== fallback) params.set(key, value)
  }

  return params.toString()
}

interface HistoryResult {
  records: GenerationRecord[]
  activeCount: number
  nextCursor: string | null
  isLoading: boolean
  isValidating: boolean
  hasMore: boolean
  loadMore: () => void
  mutateHistory: () => Promise<unknown>
}

export function useHistory(): HistoryResult {
  const filters = useHistoryViewStore((state) => state.filters)
  const query = historyKey(filters)

  const { data, isLoading, isValidating, size, setSize, mutate } =
    useSWRInfinite<GenerationListResult>(
      (index: number, previous: GenerationListResult | null) => {
        if (index > 0 && isNil(previous?.nextCursor)) return null

        const params = new URLSearchParams(query)

        if (index > 0 && !isNil(previous?.nextCursor)) params.set('cursor', previous.nextCursor)

        return `/api/generations?${params.toString()}`
      },
      fetcher,
      {
        keepPreviousData: true,
        revalidateOnFocus: true,
        refreshWhenHidden: true,
      },
    )

  useEffect(() => {
    registerHistoryRefresh(mutate)

    return () => registerHistoryRefresh(null)
  }, [mutate])

  const records = useMemo(() => loadedRecords(data), [data])

  // Local active records keep title and overlay honest when the server lags.
  const activeCount = Math.max(data?.[0]?.activeCount ?? 0, countActive(records))
  const nextCursor = data?.at(-1)?.nextCursor ?? null

  useHistoryPoll({ activeCount, records, mutate })

  const loadMore = useCallback(() => {
    if (isNil(nextCursor) || nextCursor === '' || isValidating) return

    void setSize(size + 1)
  }, [isValidating, nextCursor, setSize, size])

  return {
    records,
    activeCount,
    nextCursor,
    isLoading,
    isValidating,
    hasMore: Boolean(nextCursor),
    loadMore,
    mutateHistory: revalidateHistory,
  }
}
