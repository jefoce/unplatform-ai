'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { isFunction, isNil, uniqBy } from 'lodash-es'
import useSWRInfinite, { type SWRInfiniteKeyedMutator } from 'swr/infinite'

import type { ImageListResult } from '@/core/api/image'
import { isNonEmptyString } from '@/core/guards'
import type { ImageRecord } from '@/core/schemas/image-record'
import { fetchImagePage, imagePageKey } from '@/lib/api/images'
import { currentFavoriteEpoch } from '@/lib/favorite-epoch'
import { registerImageFeed } from '@/lib/image-feed-refresh'
import { patchImagePages } from '@/lib/image-page-patch'

interface ImagePageFilters {
  favorite?: boolean
  presetId?: string
  q?: string
}

interface UseImagePagesParams {
  filters: ImagePageFilters
  refreshInterval?: number | ((pages: ImageListResult[] | undefined) => number)

  /** Keeps the feed parked while its workspace tab is hidden. */
  isPaused?: boolean
}

interface ImagePages {
  records: ImageRecord[]
  activeCount: number
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: unknown
  loadMore: () => void
  mutate: SWRInfiniteKeyedMutator<ImageListResult[]>
}

interface ImagePollParams {
  interval: number | undefined
  isPaused: boolean
  mutate: SWRInfiniteKeyedMutator<ImageListResult[]>
  pageOneKey: string
}

/** Polls page 1 and patches loaded pages by record id. */
function useImagePoll(params: ImagePollParams): void {
  const { interval, isPaused, mutate, pageOneKey } = params

  useEffect(() => {
    if (isPaused || isNil(interval) || interval <= 0) {
      return
    }

    let isRunning = false
    let isCancelled = false

    const poll = async () => {
      if (isRunning) {
        return
      }

      isRunning = true
      const epoch = currentFavoriteEpoch()

      try {
        const page = await fetchImagePage(pageOneKey)

        if (isCancelled) {
          return
        }

        await mutate(
          (pages) => {
            if (isNil(pages) || pages.length === 0) {
              return pages
            }

            return patchImagePages({ pages, polled: page, epoch })
          },
          { revalidate: false },
        )
      } catch {
        // Next tick retries, polling does not surface transient errors.
      } finally {
        isRunning = false
      }
    }

    const timer = window.setInterval(() => {
      void poll()
    }, interval)

    return () => {
      isCancelled = true
      window.clearInterval(timer)
    }
  }, [interval, isPaused, mutate, pageOneKey])
}

/** Image feed pages until the cursor ends, polled when the caller asks for it. */
export function useImagePages(params: UseImagePagesParams): ImagePages {
  const { filters, refreshInterval, isPaused = false } = params

  const { data, error, isLoading, isValidating, size, setSize, mutate } =
    useSWRInfinite<ImageListResult>(
      (index: number, previous: ImageListResult | null) => {
        if (isPaused) {
          return null
        }

        if (index === 0) {
          return imagePageKey(filters)
        }

        const cursor = previous?.nextCursor

        if (!isNonEmptyString(cursor)) {
          return null
        }

        return imagePageKey({ ...filters, cursor })
      },
      fetchImagePage,
      {
        keepPreviousData: true,
        revalidateOnFocus: false,
      },
    )

  useEffect(() => {
    return registerImageFeed(mutate)
  }, [mutate])

  const pageOneKey = imagePageKey(filters)
  let interval: number | undefined

  if (isFunction(refreshInterval)) {
    interval = refreshInterval(data)
  } else {
    interval = refreshInterval
  }

  useImagePoll({ interval, isPaused, mutate, pageOneKey })

  const records = useMemo(() => {
    return uniqBy(
      data?.flatMap((page) => {
        return page.items
      }) ?? [],
      'id',
    )
  }, [data])

  const nextCursor = data?.at(-1)?.nextCursor ?? null
  const activeCount = data?.[0]?.activeCount ?? 0

  const loadMore = useCallback(() => {
    if (!isNonEmptyString(nextCursor) || isValidating) {
      return
    }

    void setSize(size + 1)
  }, [isValidating, nextCursor, setSize, size])

  return {
    records,
    activeCount,
    isLoading,
    isLoadingMore: isValidating,
    hasMore: Boolean(nextCursor),
    error,
    loadMore,
    mutate,
  }
}
