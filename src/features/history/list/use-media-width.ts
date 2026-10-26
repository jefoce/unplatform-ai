'use client'

import { type RefObject, useEffect, useState } from 'react'
import { isNil } from 'lodash-es'

/** Live content width of an element, 0 until the first resize observation. */
export function useMediaWidth(ref: RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const node = ref.current

    if (!node) {
      return
    }

    const observer = new ResizeObserver(([entry]) => {
      if (isNil(entry)) {
        return
      }

      setWidth(entry.contentRect.width)
    })

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [ref])

  return width
}
