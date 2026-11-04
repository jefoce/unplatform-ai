'use client'

import { useCallback, useMemo } from 'react'
import { uniqBy } from 'lodash-es'
import useSWRInfinite from 'swr/infinite'

import type { GenerationListResult } from '@/core/api/video'
import { isNonEmptyString } from '@/core/guards'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { HistoryFilters } from '@/core/types'
import { fetchGenerationPage, generationPageKey } from '@/lib/api/generations'

interface UseGenerationPagesParams {
  isFavorite: boolean
  isPaused?: boolean
}

interface GenerationPages {
  records: GenerationRecord[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  loadMore: () => void
}

/** Video record pages until the cursor ends, for the picker tabs. */
export function useGenerationPages(params: UseGenerationPagesParams): GenerationPages {
  const { isFavorite, isPaused = false } = params
  const filters: HistoryFilters = { favorite: isFavorite }

  const { data, isLoading, isValidating, size, setSize } = useSWRInfinite<GenerationListResult>(
    (index: number, previous: GenerationListResult | null) => {
      if (isPaused) {
        return null
      }

      return generationPageKey({ filters, index, previous })
    },
    fetchGenerationPage,
    { keepPreviousData: true, revalidateOnFocus: false },
  )

  const records = useMemo(() => {
    return uniqBy(
      data?.flatMap((page) => {
        return page.items
      }) ?? [],
      'id',
    )
  }, [data])

  const nextCursor = data?.at(-1)?.nextCursor ?? null

  const loadMore = useCallback(() => {
    if (!isNonEmptyString(nextCursor) || isValidating) {
      return
    }

    void setSize(size + 1)
  }, [isValidating, nextCursor, setSize, size])

  return {
    records,
    isLoading,
    isLoadingMore: isValidating,
    hasMore: Boolean(nextCursor),
    loadMore,
  }
}
