'use client'

import { type RefObject, useEffect, useLayoutEffect, useState } from 'react'
import { isNil } from 'lodash-es'

import { MEDIA_WIDTH_RETRY_FRAMES } from '@/core/constants'

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** Live content width, remeasured until the layout reports a non-zero value. */
export function useMediaWidth(ref: RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0)

  useIsomorphicLayoutEffect(() => {
    const node = ref.current

    if (isNil(node)) {
      return
    }

    let frame = 0
    let attempts = 0
    let observer: ResizeObserver | null = null

    const measure = (): void => {
      frame = 0
      const next = node.getBoundingClientRect().width

      if (next > 0) {
        setWidth(next)

        return
      }

      // WebView2 can report 0 before the first layout pass; retry next frame.
      if (attempts >= MEDIA_WIDTH_RETRY_FRAMES) {
        return
      }

      attempts += 1
      frame = window.requestAnimationFrame(measure)
    }

    measure()

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(([entry]) => {
        if (!isNil(entry) && entry.contentRect.width > 0) {
          setWidth(entry.contentRect.width)
        }
      })

      observer.observe(node)
    }

    const handleResize = (): void => {
      const next = node.getBoundingClientRect().width

      if (next > 0) {
        setWidth(next)

        return
      }

      if (frame === 0) {
        attempts = 0
        measure()
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }, [ref])

  return width
}
