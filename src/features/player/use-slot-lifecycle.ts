'use client'

import { type RefObject, useEffect } from 'react'

interface UseSlotLifecycleParams {
  id: string
  rootRef: RefObject<HTMLDivElement | null>
  videoRef: RefObject<HTMLVideoElement | null>
  isSlotActive: boolean
  isInteractive: boolean
  release: (id: string) => void
}

/** Releases the slot on unmount, when scrolled away, and in selection mode. */
export function useSlotLifecycle(params: UseSlotLifecycleParams): void {
  const { id, rootRef, videoRef, isSlotActive, isInteractive, release } = params

  useEffect(() => {
    const node = rootRef.current

    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) release(id)
      },
      { rootMargin: '200px 0px' },
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [id, release, rootRef])

  useEffect(() => () => release(id), [id, release])

  // Selection mode turns the player off for unselected list rows.
  useEffect(() => {
    if (isInteractive || !isSlotActive) return

    videoRef.current?.pause()
    release(id)
  }, [isSlotActive, id, isInteractive, release, videoRef])
}
