'use client'

import { type RefObject, useEffect, useState } from 'react'
import { isNil } from 'lodash-es'

import { IMAGE_ROW_OVERSCAN } from '@/core/constants'
import type { MasonryRow } from '@/core/feed/masonry-types'

export interface RowRange {
  start: number
  end: number
}

export interface VisibleRowRangeParams {
  rows: readonly MasonryRow[]
  top: number
  height: number
  overscan: number
}

interface Viewport {
  top: number
  height: number
}

/** First row whose bottom is below `top`. */
function firstRowBelow(rows: readonly MasonryRow[], top: number): number {
  let low = 0
  let high = rows.length

  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    const row = rows[middle]

    if (!isNil(row) && row.y + row.height <= top) {
      low = middle + 1
    } else {
      high = middle
    }
  }

  return low
}

/** Last row whose top is above `bottom`, -1 when none. */
function lastRowAbove(rows: readonly MasonryRow[], bottom: number): number {
  let low = 0
  let high = rows.length

  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    const row = rows[middle]

    if (!isNil(row) && row.y < bottom) {
      low = middle + 1
    } else {
      high = middle
    }
  }

  return low - 1
}

/** Row indexes to render for a viewport, grown by the overscan row count. */
export function visibleRowRange(params: VisibleRowRangeParams): RowRange {
  const { rows, top, height, overscan } = params

  if (rows.length === 0) {
    return { start: 0, end: -1 }
  }

  // Before the viewport height is known, paint the first rows plus the overscan
  // instead of the whole feed.
  if (height <= 0) {
    return { start: 0, end: Math.min(rows.length - 1, overscan) }
  }

  // Rows are ordered by y, so both edges are a binary search.
  const first = firstRowBelow(rows, top)
  const last = lastRowAbove(rows, top + height)

  if (first >= rows.length || last < 0) {
    return { start: 0, end: -1 }
  }

  return {
    start: Math.max(0, first - overscan),
    end: Math.min(rows.length - 1, last + overscan),
  }
}

const findScrollParent = (node: HTMLElement | null): HTMLElement | null => {
  let current = node?.parentElement ?? null

  while (current) {
    const overflow = getComputedStyle(current).overflowY

    if (overflow === 'auto' || overflow === 'scroll') {
      return current
    }

    current = current.parentElement
  }

  return null
}

/** Visible row range from the nearest scroll parent, all rows until measured. */
export function useMasonryWindow(
  rows: readonly MasonryRow[],
  containerRef: RefObject<HTMLDivElement | null>,
): RowRange {
  const [viewport, setViewport] = useState<Viewport>({ top: 0, height: 0 })

  useEffect(() => {
    const node = containerRef.current

    if (!node) {
      return
    }

    const scroller = findScrollParent(node)

    const measure = () => {
      const rect = node.getBoundingClientRect()
      const scrollerRect = scroller?.getBoundingClientRect()
      const scrollTop = scroller?.scrollTop ?? 0
      let containerTop = 0

      if (!isNil(scrollerRect)) {
        containerTop = rect.top - scrollerRect.top + scrollTop
      }

      const height = scroller?.clientHeight ?? node.clientHeight

      setViewport((previous) => {
        const top = scrollTop - containerTop
        const isSame = previous.top === top && previous.height === height

        if (isSame) {
          return previous
        }

        return { top, height }
      })
    }

    let frame = 0

    const schedule = () => {
      if (frame !== 0) {
        return
      }

      frame = requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    }

    measure()

    const target: HTMLElement | Window = scroller ?? window

    target.addEventListener('scroll', schedule)
    window.addEventListener('resize', schedule)

    return () => {
      cancelAnimationFrame(frame)
      target.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [containerRef])

  return visibleRowRange({
    rows,
    top: viewport.top,
    height: viewport.height,
    overscan: IMAGE_ROW_OVERSCAN,
  })
}
