'use client'

import { type RefObject, useEffect, useLayoutEffect, useState } from 'react'
import { isNil } from 'lodash-es'

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
    let observer: ResizeObserver | null = null

    const measure = (): void => {
      const next = node.getBoundingClientRect().width

      if (next > 0) {
        setWidth(next)

        return
      }

      // WebView2 can report 0 before the first layout pass; retry next frame.
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
