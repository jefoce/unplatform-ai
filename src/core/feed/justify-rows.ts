import { chunk, isNil } from 'lodash-es'

import { IMAGE_ROW_MAX_HEIGHT, IMAGE_ROW_MIN_HEIGHT } from '../constants'
import type { JustifyRowsParams, MasonryItem, MasonryRow, MasonryRowItem } from './masonry-types'

const PARTIAL_ROW_GROWTH = 1.25

interface RowLayout {
  y: number
  height: number
  items: MasonryRowItem[]
}

const aspectOf = (aspect: number): number => {
  const isValid = Number.isFinite(aspect) && aspect > 0

  if (!isValid) {
    return 1
  }

  return aspect
}

/** Height that fills the width at the row's natural aspect. */
function fillHeightOf(params: FillHeightParams): number {
  const { items, width, gap } = params
  const gaps = gap * Math.max(items.length - 1, 0)

  const total = items.reduce((sum, item) => {
    return sum + aspectOf(item.aspect)
  }, 0)

  return (width - gaps) / total
}

interface FillHeightParams {
  items: readonly MasonryItem[]
  width: number
  gap: number
}

interface RowLayoutParams {
  y: number
  width: number
  gap: number
  height?: number
  isJustified?: boolean
}

/** One row at its fill height or the given height; justified rows snap the last tile. */
function layoutRow(items: readonly MasonryItem[], params: RowLayoutParams): RowLayout {
  const { y, width, gap, height: fixedHeight, isJustified = false } = params
  const fillHeight = fillHeightOf({ items, width, gap })
  let layoutHeight = fillHeight

  if (!isNil(fixedHeight)) {
    layoutHeight = Math.min(fixedHeight, fillHeight)
  }

  const height = Math.max(layoutHeight, IMAGE_ROW_MIN_HEIGHT)

  let x = 0

  const placed = items.map((item, index) => {
    const isLast = index === items.length - 1
    const startX = Math.round(x)
    const naturalEnd = x + aspectOf(item.aspect) * layoutHeight
    let endX = Math.round(naturalEnd)

    if (isJustified && isLast) {
      endX = width
    }

    const placedItem = { ...item, x: startX, width: endX - startX, height }

    x = naturalEnd + gap

    return placedItem
  })

  return { y, height, items: placed }
}

/**
 * Justified rows: fixed columns per row, shared height, absolute positions.
 * Container height is the last row's `y + height`.
 */
export function justifyRows(params: JustifyRowsParams): readonly MasonryRow[] {
  const { items, width, cols, gap } = params

  if (items.length === 0 || width <= 0 || cols < 1) {
    return []
  }

  const rows: RowLayout[] = []
  let y = 0

  for (const rowItems of chunk(items, cols)) {
    const previous = rows.at(-1)
    const isPartial = rowItems.length < cols
    let row: RowLayout

    if (!isPartial) {
      row = layoutRow(rowItems, { y, width, gap, isJustified: true })
    } else if (isNil(previous)) {
      const slotWidth = (width - gap * (cols - 1)) / cols

      const slotHeight = Math.min(
        ...rowItems.map((entry) => {
          return slotWidth / aspectOf(entry.aspect)
        }),
      )

      row = layoutRow(rowItems, {
        y,
        width,
        gap,
        height: Math.min(slotHeight, IMAGE_ROW_MAX_HEIGHT),
      })
    } else {
      const fillHeight = fillHeightOf({ items: rowItems, width, gap })

      if (fillHeight <= previous.height * PARTIAL_ROW_GROWTH) {
        row = layoutRow(rowItems, { y, width, gap, isJustified: true })
      } else {
        row = layoutRow(rowItems, { y, width, gap, height: previous.height })
      }
    }

    rows.push(row)
    y += row.height + gap
  }

  return rows.map((row) => {
    return { y: row.y, height: row.height, items: row.items }
  })
}
