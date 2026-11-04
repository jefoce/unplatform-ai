'use client'

import { useMemo, useRef } from 'react'
import { chunk } from 'lodash-es'

import { HISTORY_GRID_GAP } from '@/core/constants'
import type { MasonryRow } from '@/core/feed/masonry-types'
import type { HistoryItem } from '@/lib/feed/output-items'
import { useMasonryWindow } from '@/lib/use-masonry-window'
import { useMediaWidth } from '@/lib/use-media-width'

import { HistoryTile } from './HistoryTile'
import { zoomToGridColumns } from './view-store'

interface HistoryGridProps {
  items: HistoryItem[]
  zoom: number
  onOpen: (item: HistoryItem) => void
}

/** Fixed columns per zoom, square tiles, windowed by the viewport plus two rows. */
export function HistoryGrid(props: HistoryGridProps) {
  const { items, zoom } = props
  const containerRef = useRef<HTMLDivElement>(null)

  const columns = zoomToGridColumns(zoom)
  const width = useMediaWidth(containerRef)
  const isMeasured = width > 0
  const tileWidth = (width - HISTORY_GRID_GAP * (columns - 1)) / columns
  const step = tileWidth + HISTORY_GRID_GAP

  const rows: readonly MasonryRow[] = useMemo(() => {
    if (!isMeasured) {
      return []
    }

    return chunk(items, columns).map((_, index) => {
      return { y: index * step, height: tileWidth, items: [] }
    })
  }, [columns, isMeasured, items, step, tileWidth])

  const range = useMasonryWindow(rows, containerRef)
  const totalRows = Math.ceil(items.length / columns)
  const startRow = isMeasured ? range.start : 0
  const endRow = isMeasured ? range.end : totalRows - 1
  const visible = items.slice(startRow * columns, (endRow + 1) * columns)
  const topHeight = Math.max(0, startRow * step - HISTORY_GRID_GAP)
  const bottomHeight = Math.max(0, (totalRows - 1 - endRow) * step - HISTORY_GRID_GAP)

  return (
    <div
      ref={containerRef}
      className="grid p-1"
      style={{ gap: HISTORY_GRID_GAP, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {topHeight > 0 && <div aria-hidden style={{ gridColumn: '1 / -1', height: topHeight }} />}
      {visible.map((item) => {
        const mediaWidth = isMeasured ? tileWidth : 0

        return (
          <div key={item.id} id={`history-item-${item.id}`}>
            <HistoryTile item={item} zoom={zoom} onOpen={props.onOpen} mediaWidth={mediaWidth} />
          </div>
        )
      })}
      {bottomHeight > 0 && (
        <div aria-hidden style={{ gridColumn: '1 / -1', height: bottomHeight }} />
      )}
    </div>
  )
}
