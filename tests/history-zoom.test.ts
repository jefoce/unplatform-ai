import { describe, expect, it } from 'vitest'

import { ZOOM_MAX, ZOOM_MIN } from '@/core/constants'
import { zoomToGridColumns, zoomToTileWidth } from '@/features/history/list/view-store'

const steps = Array.from({ length: ZOOM_MAX + 1 }, (_, zoom) => {
  return zoom
})

describe('zoomToGridColumns', () => {
  it('maps all six steps, from 8 columns to 3', () => {
    expect(steps.map(zoomToGridColumns)).toEqual([8, 7, 6, 5, 4, 3])
  })

  it('shrinks monotonically as zoom grows', () => {
    const columns = steps.map(zoomToGridColumns)

    expect(columns).toEqual(
      [...columns].sort((a, b) => {
        return b - a
      }),
    )

    expect(new Set(columns).size).toBe(columns.length)
  })

  it('clamps zoom outside the supported range', () => {
    expect(zoomToGridColumns(ZOOM_MIN - 4)).toBe(8)
    expect(zoomToGridColumns(ZOOM_MAX + 99)).toBe(3)
  })
})

describe('zoomToTileWidth', () => {
  it('spans 172px at zoom 0 to 486px at max zoom', () => {
    expect(zoomToTileWidth(ZOOM_MIN)).toBe(172)
    expect(zoomToTileWidth(ZOOM_MAX)).toBe(486)
  })

  it('clamps zoom outside the supported range', () => {
    expect(zoomToTileWidth(-4)).toBe(172)
    expect(zoomToTileWidth(99)).toBe(486)
  })

  it('grows monotonically', () => {
    const widths = steps.map(zoomToTileWidth)

    expect(widths).toEqual(
      [...widths].sort((a, b) => {
        return a - b
      }),
    )

    expect(new Set(widths).size).toBe(widths.length)
  })
})
