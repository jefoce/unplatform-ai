'use client'

import { useEffect, useMemo, useRef } from 'react'
import { isNil, keyBy } from 'lodash-es'

import { IMAGE_GRID_GAP } from '@/core/constants'
import { justifyRows } from '@/core/feed/justify-rows'
import { type HistoryItem, itemAspect } from '@/lib/feed/output-items'
import { useMasonryWindow } from '@/lib/use-masonry-window'
import { useMediaWidth } from '@/lib/use-media-width'

import { HistoryTile } from './HistoryTile'
import { zoomToGridColumns } from './view-store'

const NEAR_END_ROWS = 5

interface MasonryGridProps {
  items: HistoryItem[]
  zoom: number
  onOpen: (item: HistoryItem) => void

  /** Called when the visible range reaches the last five rows. */
  onNearEnd?: () => void
}

/** Justified rows, absolutely placed, windowed by the viewport plus two rows. */
export function MasonryGrid(props: MasonryGridProps) {
  const { items, zoom, onNearEnd } = props
  const containerRef = useRef<HTMLDivElement>(null)

  const width = useMediaWidth(containerRef)
  const isMeasured = width > 0

  const rows = useMemo(() => {
    return justifyRows({
      items: items.map((item) => {
        return { id: item.id, aspect: itemAspect(item) }
      }),
      width,
      cols: zoomToGridColumns(zoom),
      gap: IMAGE_GRID_GAP,
    })
  }, [items, width, zoom])

  const range = useMasonryWindow(rows, containerRef)

  useEffect(() => {
    if (isNil(onNearEnd) || rows.length === 0) {
      return
    }

    if (range.end >= rows.length - 1 - NEAR_END_ROWS) {
      onNearEnd()
    }
  }, [onNearEnd, range.end, rows.length])

  const byId = useMemo(() => {
    return keyBy(items, 'id')
  }, [items])

  const lastRow = rows.at(-1)
  const visibleStart = isMeasured ? range.start : 0
  const visibleEnd = isMeasured ? range.end + 1 : 0
  const visibleRows = rows.slice(visibleStart, visibleEnd)

  let totalHeight = 0

  if (!isNil(lastRow) && isMeasured) {
    totalHeight = lastRow.y + lastRow.height
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ height: totalHeight }}
      data-grid-width={width}
    >
      {visibleRows.map((row) => {
        return row.items.map((tile) => {
          const item = byId[tile.id]

          if (isNil(item)) {
            return null
          }

          return (
            <div
              key={tile.id}
              id={`history-item-${tile.id}`}
              className="absolute"
              style={{ left: tile.x, top: row.y, width: tile.width, height: tile.height }}
            >
              <HistoryTile
                item={item}
                zoom={zoom}
                onOpen={props.onOpen}
                variant="masonry"
                mediaWidth={tile.width}
                tileHeight={tile.height}
              />
            </div>
          )
        })
      })}
    </div>
  )
}
