'use client'

import { type RefObject, useEffect, useRef } from 'react'
import { isNil } from 'lodash-es'

type RestoreTimerId = ReturnType<typeof setTimeout>

interface ScrollRestore {
  scrollRef: RefObject<HTMLDivElement | null>
  handleScroll: () => void
}

/** Keep the grid scroll position across the details modal. */
export function useScrollRestore(isViewerOpen: boolean): ScrollRestore {
  const scrollRef = useRef<HTMLDivElement>(null)
  const latestScrollRef = useRef(0)
  const savedScrollRef = useRef(0)
  const restoreTimersRef = useRef<Array<RestoreTimerId>>([])

  const handleScroll = () => {
    latestScrollRef.current = scrollRef.current?.scrollTop ?? 0
  }

  useEffect(() => {
    const node = scrollRef.current

    if (isNil(node)) {
      return
    }

    if (isViewerOpen) {
      savedScrollRef.current = latestScrollRef.current

      return
    }

    const saved = savedScrollRef.current

    if (saved <= 0) {
      return
    }

    const restore = () => {
      node.scrollTop = saved
    }

    // Radix restores focus after the modal unmounts and can reset scroll, so
    // repeat the restore once focus has settled.
    restoreTimersRef.current = [setTimeout(restore, 0), setTimeout(restore, 120)]

    return () => {
      for (const timer of restoreTimersRef.current) {
        clearTimeout(timer)
      }

      restoreTimersRef.current = []
    }
  }, [isViewerOpen])

  return { scrollRef, handleScroll }
}
