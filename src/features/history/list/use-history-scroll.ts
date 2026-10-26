'use client'

import { useEffect, useRef } from 'react'
import { isNil } from 'lodash-es'

/** Infinite-scroll sentinel for the history feed. */
export function useHistoryScroll(hasMore: boolean, loadMore: () => void) {
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = sentinel.current

    if (!node || !hasMore) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!isNil(entry) && entry.isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: '400px 0px' },
    )

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [hasMore, loadMore])

  return sentinel
}
