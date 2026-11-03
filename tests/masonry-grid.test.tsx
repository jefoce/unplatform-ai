// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HistoryGrid } from '@/features/history/list/HistoryGrid'
import { MasonryGrid } from '@/features/history/list/MasonryGrid'
import { ViewToggle } from '@/features/history/list/ViewToggle'
import { visibleRowRange } from '@/lib/use-masonry-window'

import { IMAGE_GRID_GAP } from '../src/core/constants'
import { justifyRows } from '../src/core/feed/justify-rows'
import { handleNoop, item, Observer } from './helpers/history'
import { required } from './helpers/required'

type ResizeCallback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void

class WidthObserver {
  static callback: ResizeCallback | null = null
  static width = 800

  constructor(callback: ResizeCallback) {
    WidthObserver.callback = callback
  }

  static emit(width: number): void {
    WidthObserver.callback?.(
      [{ contentRect: { width } } as ResizeObserverEntry],
      undefined as unknown as ResizeObserver,
    )
  }

  observe(): void {
    WidthObserver.emit(WidthObserver.width)
  }

  unobserve(): void {}

  disconnect(): void {}
}

const rows = justifyRows({
  items: Array.from({ length: 8 }, (_, index) => {
    return { id: `${index}`, aspect: 1 }
  }),
  width: 1000,
  cols: 4,
  gap: IMAGE_GRID_GAP,
})

const tile = (id: string): HTMLElement => {
  return required(document.querySelector<HTMLElement>(`#history-item-${id}`), `tile ${id}`)
}

const squareItems = () => {
  return ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => {
    return item(id)
  })
}

beforeEach(() => {
  WidthObserver.width = 800
  vi.stubGlobal('ResizeObserver', WidthObserver)
  vi.stubGlobal('IntersectionObserver', Observer)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('visibleRowRange', () => {
  it('returns the rows under the viewport plus the overscan', () => {
    expect(visibleRowRange({ rows, top: 0, height: 100, overscan: 0 })).toEqual({
      start: 0,
      end: 0,
    })

    expect(visibleRowRange({ rows, top: 251, height: 247, overscan: 0 })).toEqual({
      start: 1,
      end: 1,
    })

    expect(visibleRowRange({ rows, top: 251, height: 247, overscan: 1 })).toEqual({
      start: 0,
      end: 1,
    })
  })

  it('keeps a short feed until the viewport is measured', () => {
    expect(visibleRowRange({ rows, top: 0, height: 0, overscan: 2 })).toEqual({ start: 0, end: 1 })

    expect(visibleRowRange({ rows: [], top: 0, height: 100, overscan: 2 })).toEqual({
      start: 0,
      end: -1,
    })
  })
})

describe('MasonryGrid', () => {
  it('places tiles absolutely and sizes the container', () => {
    render(<MasonryGrid items={squareItems().slice(0, 4)} zoom={5} onOpen={handleNoop} />)

    const first = tile('a')

    expect(first.className).toContain('absolute')
    expect(first.style.left).toBe('0px')
    expect(first.style.top).toBe('0px')
    expect(Number.parseFloat(first.style.width)).toBeGreaterThan(0)
    expect(Number.parseFloat(first.style.height)).toBeGreaterThan(0)

    const container = required(first.parentElement, 'container')

    expect(Number.parseFloat(container.style.height)).toBeGreaterThan(0)
  })

  it('uses the zoom columns for the row count', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

    const view = render(
      <MasonryGrid
        items={ids.map((id) => {
          return item(id)
        })}
        zoom={0}
        onOpen={handleNoop}
      />,
    )

    const topsAtEight = new Set(
      ids.map((id) => {
        return tile(id).style.top
      }),
    )

    expect(topsAtEight.size).toBe(1)

    view.rerender(
      <MasonryGrid
        items={ids.map((id) => {
          return item(id)
        })}
        zoom={5}
        onOpen={handleNoop}
      />,
    )

    const topsAtThree = new Set(
      ids.map((id) => {
        return tile(id).style.top
      }),
    )

    expect(topsAtThree.size).toBe(3)
    view.unmount()
  })

  it('widens the same tile when the zoom step grows', () => {
    const view = render(<MasonryGrid items={squareItems()} zoom={0} onOpen={handleNoop} />)
    const widthAtEight = Number.parseFloat(tile('a').style.width)

    view.rerender(<MasonryGrid items={squareItems()} zoom={5} onOpen={handleNoop} />)
    const widthAtThree = Number.parseFloat(tile('a').style.width)

    expect(widthAtThree).toBeGreaterThan(widthAtEight)
  })

  it('keeps masonry video tiles square and grid video tiles rounded', () => {
    const masonry = render(
      <MasonryGrid items={squareItems().slice(0, 1)} zoom={5} onOpen={handleNoop} />,
    )

    const masonryTile = required(
      masonry.container.querySelector<HTMLElement>('#history-item-a [role="button"]'),
      'masonry tile',
    )

    expect(masonryTile.className).toContain('rounded-none')
    expect(masonryTile.className).not.toContain('rounded-2xl')

    masonry.unmount()

    const grid = render(
      <HistoryGrid items={squareItems().slice(0, 1)} zoom={5} onOpen={handleNoop} />,
    )

    const gridTile = required(
      grid.container.querySelector<HTMLElement>('#history-item-a [role="button"]'),
      'grid tile',
    )

    expect(gridTile.className).toContain('rounded-2xl')
  })
})

describe('MasonryGrid row edges', () => {
  it('ends the last tile of every rendered full row at the container width', () => {
    const items = Array.from({ length: 12 }, (_, index) => {
      return item(`r${index}`)
    })

    render(<MasonryGrid items={items} zoom={5} onOpen={handleNoop} />)

    const rows = new Map<string, number>()

    for (const element of document.querySelectorAll<HTMLElement>('[id^="history-item-"]')) {
      const left = Number.parseFloat(element.style.left)
      const width = Number.parseFloat(element.style.width)
      const top = element.style.top
      const right = left + width

      rows.set(top, Math.max(rows.get(top) ?? 0, right))
    }

    expect(rows.size).toBeGreaterThan(0)

    for (const right of rows.values()) {
      expect(right).toBe(800)
    }
  })
})

describe('HistoryGrid windowing', () => {
  it('renders only the viewport rows plus the overscan', () => {
    WidthObserver.width = 800

    const items = Array.from({ length: 40 }, (_, index) => {
      return item(`g${index}`)
    })

    render(<HistoryGrid items={items} zoom={5} onOpen={handleNoop} />)

    expect(tile('g8')).toBeTruthy()
    expect(document.querySelector('#history-item-g9')).toBeNull()
  })

  it('keeps every tile until the width is measured', () => {
    WidthObserver.width = 0

    const items = Array.from({ length: 40 }, (_, index) => {
      return item(`u${index}`)
    })

    render(<HistoryGrid items={items} zoom={5} onOpen={handleNoop} />)

    expect(tile('u39')).toBeTruthy()
  })
})

describe('MasonryGrid measurement', () => {
  it('renders no tiles until the width is measured', () => {
    WidthObserver.width = 0

    render(<MasonryGrid items={squareItems()} zoom={5} onOpen={handleNoop} />)

    expect(document.querySelector('#history-item-a')).toBeNull()

    act(() => {
      WidthObserver.emit(800)
    })

    expect(tile('a')).toBeTruthy()
  })

  it('renders only the first overscan rows until the viewport is measured', () => {
    const items = Array.from({ length: 40 }, (_, index) => {
      return item(`t${index}`)
    })

    render(<MasonryGrid items={items} zoom={5} onOpen={handleNoop} />)

    expect(tile('t8')).toBeTruthy()
    expect(document.querySelector('#history-item-t9')).toBeNull()
  })
})

describe('ViewToggle', () => {
  it('reports the picked view without owning the store', () => {
    const onViewChange = vi.fn()

    render(<ViewToggle view="grid" onViewChange={onViewChange} views={['grid', 'masonry']} />)

    fireEvent.click(screen.getByRole('tab', { name: 'Masonry' }))

    expect(onViewChange).toHaveBeenCalledWith('masonry')
  })

  it('lets the label size the tab, with a fixed icon slot and a 14px icon', () => {
    render(<ViewToggle view="grid" onViewChange={vi.fn()} views={['grid', 'masonry']} />)

    const tabs = screen.getAllByRole('tab')

    for (const tab of tabs) {
      const icon = required(tab.querySelector('svg'), 'icon')
      const slot = required(icon.parentElement, 'icon slot')
      const label = required(tab.lastElementChild, 'label')

      expect(tab.className).not.toContain('w-16')
      expect(slot.className).toContain('shrink-0')
      expect(icon.getAttribute('width')).toBe('14')
      expect(icon.getAttribute('height')).toBe('14')
      expect(label.className).toContain('whitespace-nowrap')
    }
  })
})
