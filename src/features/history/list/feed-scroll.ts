'use client'

import { createContext, type RefObject, useContext, useEffect, useState } from 'react'
import { isNil } from 'lodash-es'

/** Scroll distance above which the feed is past its rest position. */
export const FEED_SCROLL_THRESHOLD_PX = 8

/** True once the feed scrolled past the rest threshold. */
export function isFeedScrolled(scrollTop: number): boolean {
  return scrollTop > FEED_SCROLL_THRESHOLD_PX
}

/** Scroll state of the surrounding feed, false outside an overlay feed. */
export const FeedScrollContext = createContext(false)

/** True when the surrounding feed has scrolled past the rest threshold. */
export function useIsFeedScrolled(): boolean {
  return useContext(FeedScrollContext)
}

/** Scroll-past-rest state for one scroll container, measured once per frame. */
export function useFeedScrolled(
  scrollRef: RefObject<HTMLDivElement | null>,
  isEnabled: boolean,
): boolean {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const node = scrollRef.current

    if (!isEnabled || isNil(node)) {
      setIsScrolled(false)

      return
    }

    let frame = 0

    const measure = () => {
      frame = 0
      setIsScrolled(isFeedScrolled(node.scrollTop))
    }

    const handleScroll = () => {
      if (frame !== 0) {
        return
      }

      frame = requestAnimationFrame(measure)
    }

    measure()
    node.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      cancelAnimationFrame(frame)
      node.removeEventListener('scroll', handleScroll)
    }
  }, [isEnabled, scrollRef])

  return isScrolled
}
