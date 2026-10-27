'use client'

import { useCallback, useEffect, useRef } from 'react'
import { isEmpty, isNil } from 'lodash-es'

export interface HistoryNavParams {
  selectedId: string | null
  viewOrder: string[]
  hasMore: boolean
  isLoadingMore: boolean
  navigate: (id: string) => void
  onLoadMore: () => void
  close: () => void
}

/** Record position in the view order, paging and delete recovery. */
export function useHistoryNav(params: HistoryNavParams) {
  const { selectedId, viewOrder, hasMore, isLoadingMore, navigate, onLoadMore, close } = params

  let index = -1

  if (!isNil(selectedId)) {
    index = viewOrder.indexOf(selectedId)
  }

  const lastIndexRef = useRef(0)

  useEffect(() => {
    if (index >= 0) {
      lastIndexRef.current = index
    }
  }, [index])

  // A delete removes the record from viewOrder. Pick the id now at its old slot.
  useEffect(() => {
    if (isNil(selectedId) || index !== -1) {
      return
    }

    if (isEmpty(viewOrder)) {
      close()

      return
    }

    const nextId = viewOrder[Math.min(lastIndexRef.current, viewOrder.length - 1)]

    if (!isNil(nextId) && nextId !== selectedId) {
      navigate(nextId)
    }
  }, [close, index, navigate, selectedId, viewOrder])

  useEffect(() => {
    if (index < 0 || !hasMore || isLoadingMore) {
      return
    }

    if (index >= viewOrder.length - 3) {
      onLoadMore()
    }
  }, [hasMore, index, isLoadingMore, onLoadMore, viewOrder.length])

  const handlePrevious = useCallback(() => {
    const previousId = viewOrder[index - 1]

    if (index > 0 && !isNil(previousId)) {
      navigate(previousId)
    }
  }, [index, navigate, viewOrder])

  const handleNext = useCallback(() => {
    const nextId = viewOrder[index + 1]

    if (index < viewOrder.length - 1 && !isNil(nextId)) {
      navigate(nextId)

      return
    }

    if (hasMore) {
      onLoadMore()
    }
  }, [hasMore, index, navigate, onLoadMore, viewOrder])

  return {
    hasPrevious: index > 0,
    hasNext: index >= 0 && (index < viewOrder.length - 1 || hasMore),
    onPrevious: handlePrevious,
    onNext: handleNext,
  }
}
