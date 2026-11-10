/* eslint-disable max-lines -- row layout cases share one suite */

import { describe, expect, it } from 'vitest'

import { IMAGE_ROW_MAX_HEIGHT, IMAGE_ROW_MIN_HEIGHT } from '../src/core/constants'
import { justifyRows } from '../src/core/feed/justify-rows'
import type { MasonryItem, MasonryRow } from '../src/core/feed/masonry-types'
import { required } from './helpers/required'

const item = (id: string, aspect: number): MasonryItem => {
  return { id, aspect }
}

const widthOf = (row: MasonryRow): number => {
  const last = required(row.items.at(-1), 'last item')

  return last.x + last.width
}

const rowAt = (rows: readonly MasonryRow[], index: number): MasonryRow => {
  return required(rows.at(index), `row ${index}`)
}

describe('justifyRows', () => {
  it('fills the container width exactly on a full row', () => {
    const rows = justifyRows({
      items: [item('a', 1), item('b', 1), item('c', 1), item('d', 1)],
      width: 1000,
      cols: 4,
      gap: 4,
    })

    expect(rows).toHaveLength(1)
    expect(widthOf(rowAt(rows, 0))).toBe(1000)
  })

  it('fills the width for very wide images without a cap', () => {
    const rows = justifyRows({
      items: [item('a', 10), item('b', 10)],
      width: 2000,
      cols: 2,
      gap: 4,
    })

    expect(rowAt(rows, 0).height).toBe(IMAGE_ROW_MIN_HEIGHT)
    expect(widthOf(rowAt(rows, 0))).toBe(2000)
  })

  it('fills the width for very tall images without a cap', () => {
    const rows = justifyRows({
      items: [item('a', 0.1), item('b', 0.1)],
      width: 2000,
      cols: 2,
      gap: 4,
    })

    expect(rowAt(rows, 0).height).toBeGreaterThan(1000)
    expect(widthOf(rowAt(rows, 0))).toBe(2000)
  })

  it('returns no rows for empty input or no width', () => {
    expect(justifyRows({ items: [], width: 800, cols: 4, gap: 4 })).toEqual([])
    expect(justifyRows({ items: [item('a', 1)], width: 0, cols: 4, gap: 4 })).toEqual([])
  })

  it('uses the slot width when cols is larger than the item count', () => {
    const rows = justifyRows({
      items: [item('a', 1), item('b', 1)],
      width: 1000,
      cols: 6,
      gap: 4,
    })

    const slotWidth = (1000 - 4 * 5) / 6

    expect(rows).toHaveLength(1)
    expect(rowAt(rows, 0).items).toHaveLength(2)
    expect(rowAt(rows, 0).height).toBeCloseTo(slotWidth)
    expect(widthOf(rowAt(rows, 0))).toBe(331)
  })

  it('caps the slot height of a single tall first row', () => {
    const rows = justifyRows({ items: [item('a', 0.1)], width: 2000, cols: 4, gap: 4 })

    expect(rowAt(rows, 0).height).toBe(IMAGE_ROW_MAX_HEIGHT)
  })

  it('stacks rows by height plus gap', () => {
    const rows = justifyRows({
      items: [item('a', 1), item('b', 1), item('c', 1), item('d', 1)],
      width: 1000,
      cols: 2,
      gap: 4,
    })

    const last = required(rows.at(-1), 'last row')

    expect(rowAt(rows, 1).y).toBeCloseTo(rowAt(rows, 0).height + 4)
    expect(last.y + last.height).toBeCloseTo(1000)
  })
})

describe('justifyRows fewer items than columns', () => {
  it('uses one column slot per item, wider tiles at fewer columns', () => {
    const atEight = justifyRows({ items: [item('a', 2)], width: 1000, cols: 8, gap: 4 })
    const atThree = justifyRows({ items: [item('a', 2)], width: 1000, cols: 3, gap: 4 })

    const widthAtEight = required(rowAt(atEight, 0).items.at(0), 'eight columns').width
    const widthAtThree = required(rowAt(atThree, 0).items.at(0), 'three columns').width

    expect(widthAtEight).toBe(Math.round((1000 - 4 * 7) / 8))
    expect(widthAtThree).toBe(Math.round((1000 - 4 * 2) / 3))
    expect(widthAtThree).toBeGreaterThan(widthAtEight)
  })

  it('uses the slot width for three items at eight columns', () => {
    const rows = justifyRows({
      items: [item('a', 1), item('b', 1), item('c', 1)],
      width: 1000,
      cols: 8,
      gap: 4,
    })

    const slotWidth = (1000 - 4 * 7) / 8

    expect(rowAt(rows, 0).items).toHaveLength(3)

    for (const placed of rowAt(rows, 0).items) {
      expect(Math.abs(placed.width - slotWidth)).toBeLessThanOrEqual(1)
    }

    expect(rowAt(rows, 0).height).toBe(IMAGE_ROW_MIN_HEIGHT)
    expect(widthOf(rowAt(rows, 0))).toBe(373)
  })

  it('gives a short first row one shared height', () => {
    const aspects = [4 / 3, 1, 1, 1, 1]

    const rows = justifyRows({
      items: aspects.map((aspect, index) => {
        return item(`${index}`, aspect)
      }),
      width: 1000,
      cols: 8,
      gap: 4,
    })

    const slotWidth = (1000 - 4 * 7) / 8
    const smallestSlotHeight = Math.min(slotWidth / (4 / 3), slotWidth)
    const row = rowAt(rows, 0)

    expect(row.height).toBe(IMAGE_ROW_MIN_HEIGHT)

    for (const [index, placed] of row.items.entries()) {
      const aspect = required(aspects[index], 'aspect')

      expect(placed.height).toBe(IMAGE_ROW_MIN_HEIGHT)
      expect(Math.abs(placed.width - aspect * smallestSlotHeight)).toBeLessThanOrEqual(1)
    }

    expect(widthOf(row)).toBeLessThan(1000)
  })

  it('keeps a full row at its own column gaps', () => {
    const rows = justifyRows({
      items: [item('a', 1), item('b', 1), item('c', 1)],
      width: 1000,
      cols: 3,
      gap: 4,
    })

    expect(widthOf(rowAt(rows, 0))).toBe(1000)
  })
})

describe('justifyRows minimum height', () => {
  it('raises a short row to the minimum and keeps the fill width', () => {
    const rows = justifyRows({ items: [item('a', 21 / 9)], width: 1280, cols: 8, gap: 4 })
    const row = rowAt(rows, 0)
    const tile = required(row.items.at(0), 'tile')
    const slotWidth = (1280 - 4 * 7) / 8

    expect(row.height).toBe(IMAGE_ROW_MIN_HEIGHT)
    expect(tile.height).toBe(IMAGE_ROW_MIN_HEIGHT)
    expect(Math.abs(tile.width - slotWidth)).toBeLessThanOrEqual(1)
    expect(widthOf(row)).toBeLessThanOrEqual(1280)
  })

  it('leaves a row taller than the minimum unchanged', () => {
    const rows = justifyRows({
      items: [item('a', 1), item('b', 1), item('c', 1), item('d', 1)],
      width: 1000,
      cols: 4,
      gap: 4,
    })

    expect(rowAt(rows, 0).height).toBeCloseTo((1000 - 12) / 4)
    expect(rowAt(rows, 0).height).toBeGreaterThan(IMAGE_ROW_MIN_HEIGHT)
  })
})

describe('justifyRows row bounds', () => {
  it('never overlaps tiles or places any tile past the container', () => {
    const rows = justifyRows({
      items: [item('a', 2), item('b', 0.5), item('c', 1.5), item('d', 1), item('e', 3)],
      width: 1000,
      cols: 4,
      gap: 4,
    })

    for (const row of rows) {
      let right = 0

      for (const placed of row.items) {
        expect(placed.x).toBeGreaterThanOrEqual(right)
        expect(placed.x + placed.width).toBeLessThanOrEqual(1000)

        right = placed.x + placed.width + 4
      }
    }
  })
})

describe('justifyRows partial rows', () => {
  it('keeps the last partial row at the previous row height', () => {
    const rows = justifyRows({
      items: [item('a', 1), item('b', 1), item('c', 1)],
      width: 900,
      cols: 2,
      gap: 4,
    })

    const last = rowAt(rows, 1)

    expect(last.height).toBe(rowAt(rows, 0).height)
    expect(required(last.items.at(0), 'first item').width).toBe(last.height)
    expect(widthOf(last)).toBeLessThan(900)
  })

  it('keeps a two-item last row at the height of the four-item row', () => {
    const rows = justifyRows({
      items: [item('a', 1), item('b', 1), item('c', 1), item('d', 1), item('e', 1), item('f', 1)],
      width: 1000,
      cols: 4,
      gap: 4,
    })

    const last = rowAt(rows, 1)

    expect(last.items).toHaveLength(2)
    expect(last.height).toBeCloseTo(rowAt(rows, 0).height)
    expect(widthOf(last)).toBeLessThan(1000)
  })

  it('scales a partial row down when its wide item would overflow', () => {
    const rows = justifyRows({
      items: [item('a', 0.5), item('b', 0.5), item('c', 0.5), item('d', 0.5), item('wide', 10)],
      width: 1000,
      cols: 4,
      gap: 4,
    })

    const last = rowAt(rows, 1)

    expect(last.height).toBe(IMAGE_ROW_MIN_HEIGHT)
    expect(widthOf(last)).toBe(1000)
  })

  it('justifies a partial row that is at most 1.25 times the previous height', () => {
    const rows = justifyRows({
      items: [
        item('a', 1),
        item('b', 1),
        item('c', 1),
        item('d', 1),
        item('e', 1.2),
        item('f', 1.2),
        item('g', 1.2),
      ],
      width: 1000,
      cols: 4,
      gap: 4,
    })

    const last = rowAt(rows, 1)

    expect(last.height).toBeCloseTo((1000 - 8) / 3.6)
    expect(widthOf(last)).toBe(1000)
  })

  it('leaves a taller partial row at the previous height', () => {
    const rows = justifyRows({
      items: [item('a', 1), item('b', 1), item('c', 1), item('d', 1), item('e', 1), item('f', 1)],
      width: 1000,
      cols: 4,
      gap: 4,
    })

    const last = rowAt(rows, 1)

    expect(last.height).toBe(rowAt(rows, 0).height)
    expect(widthOf(last)).toBeLessThan(1000)
  })
})

describe('justifyRows pixel snapping', () => {
  const widths = [1280, 1728, 2560]
  const aspects = [0.5, 0.8, 1, 1.25, 1.5, 2, 0.66, 1.78]

  it('ends every full row at the container width for 3 to 8 columns', () => {
    for (const width of widths) {
      for (let cols = 3; cols <= 8; cols += 1) {
        const items = Array.from({ length: cols * 3 }, (_, index) => {
          return item(`${index}`, required(aspects[index % aspects.length], 'aspect'))
        })

        const rows = justifyRows({ items, width, cols, gap: 4 })

        for (const row of rows) {
          const last = required(row.items.at(-1), 'last item')

          expect(last.x + last.width).toBe(width)
        }
      }
    }
  })

  it('rounds every x and width to whole pixels', () => {
    const items = Array.from({ length: 40 }, (_, index) => {
      return item(`${index}`, required(aspects[index % aspects.length], 'aspect'))
    })

    const rows = justifyRows({ items, width: 1280, cols: 5, gap: 4 })

    for (const row of rows) {
      for (const placed of row.items) {
        expect(Number.isInteger(placed.x)).toBe(true)
        expect(Number.isInteger(placed.width)).toBe(true)
      }
    }
  })
})
