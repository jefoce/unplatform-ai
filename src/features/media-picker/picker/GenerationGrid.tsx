'use client'

import { useMemo, useRef } from 'react'
import { chunk, isEmpty, noop } from 'lodash-es'

import type { GridItem } from '@/core/feed/grid-item'
import type { MasonryRow } from '@/core/feed/masonry-types'
import {
  PICKER_GRID_CLASSES,
  PICKER_GRID_GAP,
  PICKER_GRID_STYLE,
  PICKER_TILE_PX,
  pickerColumns,
} from '@/features/media-picker/tiles/tile-classes'
import { useMasonryWindow } from '@/lib/use-masonry-window'
import { useMediaWidth } from '@/lib/use-media-width'
import { useScrollSentinel } from '@/lib/use-scroll-sentinel'

import { GenerationTile } from './GenerationTile'
import type { PickerOutputMode } from './store'

interface GenerationGridProps {
  items: GridItem[]
  isLoading: boolean
  modeKind: 'pick' | 'toggle'
  output?: PickerOutputMode
  emptyLabel: string
  hasMore?: boolean
  onLoadMore?: () => void
}

interface GridWindow {
  visible: GridItem[]
  topHeight: number
  bottomHeight: number
}

interface GridWindowParams {
  items: GridItem[]
  width: number
  gridRef: React.RefObject<HTMLDivElement | null>
}

const SKELETON = [0, 1, 2, 3, 4, 5, 6, 7]

function spacerHeight(rowCount: number, step: number): number {
  if (rowCount <= 0) {
    return 0
  }

  return Math.max(0, rowCount * step - PICKER_GRID_GAP)
}

/** Visible rows and the spacer heights that keep the scrollbar honest. */
function useGridWindow(params: GridWindowParams): GridWindow {
  const { items, width, gridRef } = params
  const isMeasured = width > 0
  const columns = pickerColumns(width)
  const step = PICKER_TILE_PX + PICKER_GRID_GAP

  const rows: readonly MasonryRow[] = useMemo(() => {
    if (!isMeasured) {
      return []
    }

    return chunk(items, columns).map((_, index) => {
      return { y: index * step, height: PICKER_TILE_PX, items: [] }
    })
  }, [columns, isMeasured, items, step])

  const range = useMasonryWindow(rows, gridRef)

  if (!isMeasured) {
    return { visible: items, topHeight: 0, bottomHeight: 0 }
  }

  const totalRows = Math.ceil(items.length / columns)
  const visible = items.slice(range.start * columns, (range.end + 1) * columns)
  const topHeight = spacerHeight(range.start, step)
  const bottomHeight = spacerHeight(totalRows - 1 - range.end, step)

  return { visible, topHeight, bottomHeight }
}

/** Saved generation outputs as selectable tiles, windowed by row. */
export function GenerationGrid(props: GenerationGridProps) {
  const { items, isLoading, modeKind, output, emptyLabel } = props
  const isInitialLoading = isLoading && isEmpty(items)
  const sentinel = useScrollSentinel(props.hasMore === true, props.onLoadMore ?? noop)
  const gridRef = useRef<HTMLDivElement>(null)
  const width = useMediaWidth(gridRef)
  const window = useGridWindow({ items, width, gridRef })

  return (
    <div className="min-h-0 flex-1 scrollbar-gutter-stable overflow-y-auto overscroll-contain">
      <div ref={gridRef} className={PICKER_GRID_CLASSES} style={PICKER_GRID_STYLE}>
        {window.topHeight > 0 && (
          <div aria-hidden style={{ gridColumn: '1 / -1', height: window.topHeight }} />
        )}
        {window.visible.map((item) => {
          return <GenerationTile key={item.id} item={item} modeKind={modeKind} output={output} />
        })}
        {window.bottomHeight > 0 && (
          <div aria-hidden style={{ gridColumn: '1 / -1', height: window.bottomHeight }} />
        )}

        {isInitialLoading &&
          SKELETON.map((key) => {
            return <div key={key} className="aspect-square animate-pulse rounded-lg bg-surface-2" />
          })}

        {props.hasMore === true && <div ref={sentinel} className="col-span-full h-1" />}

        {!isLoading && isEmpty(items) && (
          <p className="col-span-full py-8 text-center text-sm text-fg-2">{emptyLabel}</p>
        )}
      </div>
    </div>
  )
}
