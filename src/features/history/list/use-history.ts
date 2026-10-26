'use client'

import { useCallback, useEffect, useMemo } from 'react'
import useSWRInfinite from 'swr/infinite'

import { isNonEmptyString } from '@/core/guards'
import { countActive } from '@/core/history-filters'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { GenerationListResult } from '@/core/types'
import { fetchGenerationPage, generationPageKey } from '@/lib/api/generations'
import { registerHistoryRefresh } from '@/lib/swr-keys'

import { loadedRecords, revalidateHistory } from './history-pages'
import { useHistoryPoll } from './use-history-poll'
import { useHistoryViewStore } from './view-store'

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
  const filters = useHistoryViewStore((state) => {
    return state.filters
  })

  const { data, isLoading, isValidating, size, setSize, mutate } =
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
    registerHistoryRefresh(mutate)

    return () => {
      registerHistoryRefresh(null)
    }
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
    loadMore,
    mutateHistory: revalidateHistory,
  }
}
