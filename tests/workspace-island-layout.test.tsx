// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { FeedScrollContext } from '@/features/history/list/feed-scroll'
import { FeedSection } from '@/features/history/list/FeedSection'
import { IMAGE_FEED_TOP_PADDING } from '@/features/shared/layout'
import { WorkspaceIsland } from '@/features/workspace/WorkspaceIsland'

import { required } from './helpers/required'

vi.mock('@/features/generator/use-provider-ready', () => {
  return {
    useProviderReady: () => {
      return { isKeyMissing: false, isReady: true, reason: null }
    },
  }
})

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', Observer)
  vi.stubGlobal('IntersectionObserver', Observer)

  vi.stubGlobal('matchMedia', () => {
    return { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  })
})

afterEach(() => {
  cleanup()
})

const SCROLLED_TOKENS = [
  'opacity-10',
  'transition-opacity',
  'duration-200',
  'ease-out',
  'hover:opacity-100',
  'focus-within:opacity-100',
  'has-data-[state=open]:opacity-100',
  'pointer-coarse:opacity-100',
  'w-full',
  'pointer-events-auto',
]

const SHELL_MAX_WIDTH = 1920
const SHELL_PADDING = 16
const ASIDE_WIDTH = 320
const ISLAND_TOP = 8
const RIGHT_WIDTH = 100

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Stand-in for the browser box, so the test reads the same API as the app. */
function mockRect(element: Element, rect: Rect): void {
  const box = {
    ...rect,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
    left: rect.x,
    top: rect.y,
  } as DOMRect

  element.getBoundingClientRect = () => {
    return box
  }
}

function hasClass(element: Element, token: string): boolean {
  return element.className.split(/\s+/).includes(token)
}

interface ShellGeometry {
  contentX: number
  contentWidth: number
  leftX: number
  leftWidth: number
  rightEdge: number
  top: number
}

/** Shell geometry from the frame classes, the way the browser lays them out. */
function shellGeometry(viewport: number, header: Element, wrapper: HTMLElement): ShellGeometry {
  const shellWidth = Math.min(viewport, SHELL_MAX_WIDTH)
  const shellX = (viewport - shellWidth) / 2
  const contentX = shellX + SHELL_PADDING
  const contentWidth = shellWidth - SHELL_PADDING * 2

  const headerWidth = hasClass(header, 'max-w-480')
    ? Math.min(contentWidth, SHELL_MAX_WIDTH)
    : contentWidth

  const headerX = hasClass(header, 'mx-auto')
    ? contentX + (contentWidth - headerWidth) / 2
    : contentX

  const headerPadding = hasClass(header, 'px-4') ? SHELL_PADDING : 0
  const left = required(header.children[0], 'left surface')
  let top = Number.parseFloat(wrapper.style.paddingTop)

  if (!Number.isFinite(top)) {
    top = 0
  }

  return {
    contentX,
    contentWidth,
    leftX: headerX + headerPadding,
    leftWidth: hasClass(left, 'w-80') ? ASIDE_WIDTH : 0,
    rightEdge: headerX + headerWidth - headerPadding,
    top,
  }
}

function renderIsland() {
  render(
    <FeedSection
      items={[]}
      isLoading={false}
      hasMore={false}
      isLoadingMore={false}
      error={undefined}
      loadMore={vi.fn()}
      onRetry={vi.fn()}
      view="masonry"
      zoom={0}
      filters={{}}
      toolbar={<WorkspaceIsland />}
      toolbarPlacement="overlay"
      emptyKind="image"
      padding={{ base: 'pb-60', selecting: 'pb-60' }}
    />,
  )

  const header = required(screen.getByRole('tab', { name: 'Video' }).closest('header'), 'island')
  const wrapper = required(header.parentElement, 'island frame')

  return { header, wrapper }
}

describe('island alignment', () => {
  it.each([1280, 1728, 2560])('sits on the video shell frame at %i px', (viewport) => {
    const { header, wrapper } = renderIsland()
    const geometry = shellGeometry(viewport, header, wrapper)
    const left = required(header.children[0], 'left surface')
    const right = required(header.children[1], 'right surface')

    mockRect(header, {
      x: geometry.leftX,
      y: geometry.top,
      width: geometry.contentWidth,
      height: 48,
    })

    mockRect(left, { x: geometry.leftX, y: geometry.top, width: geometry.leftWidth, height: 48 })

    mockRect(right, {
      x: geometry.rightEdge - RIGHT_WIDTH,
      y: geometry.top,
      width: RIGHT_WIDTH,
      height: 48,
    })

    expect(left.getBoundingClientRect().x).toBe(geometry.contentX)
    expect(left.getBoundingClientRect().width).toBe(ASIDE_WIDTH)
    expect(right.getBoundingClientRect().right).toBe(geometry.contentX + geometry.contentWidth)
    expect(header.getBoundingClientRect().top).toBe(ISLAND_TOP)
  })

  it('starts opaque and fades by opacity only after scroll', () => {
    const { header } = renderIsland()

    expect(header.getAttribute('data-island')).toBe('true')
    expect(header.getAttribute('data-scrolled')).toBe('false')
    expect(hasClass(header, 'opacity-100')).toBe(true)
    expect(hasClass(header, 'opacity-10')).toBe(false)
    expect(header.className).not.toContain('pointer-events-none')
    expect(header.className).not.toContain('hidden')
    expect(header.className).not.toContain('scale-')
    expect(header.className).not.toContain('translate-')

    cleanup()

    render(
      <FeedScrollContext.Provider value>
        <WorkspaceIsland />
      </FeedScrollContext.Provider>,
    )

    const scrolled = required(
      screen.getByRole('tab', { name: 'Video' }).closest('header'),
      'island',
    )

    expect(scrolled.getAttribute('data-scrolled')).toBe('true')

    for (const token of SCROLLED_TOKENS) {
      expect(scrolled.className).toContain(token)
    }
  })

  it('centres the left row on the island centre and keeps the right centred', () => {
    const { header } = renderIsland()

    const left = required(header.children[0], 'left surface')
    const right = required(header.children[1], 'right surface')

    expect(left.className).toContain('items-center')
    expect(left.className).toContain('px-2')
    expect(left.className).not.toContain('py-1')
    expect(left.className).not.toContain('items-start')
    expect(left.className).not.toContain('pt-3.5')
    expect(right.className).not.toContain('items-start')
    expect(right.className).not.toContain('pt-3.5')
  })

  it('insets the right surface so the last control sits 8 px inside the island edge', () => {
    const { header } = renderIsland()

    const right = required(header.children[1], 'right surface')

    expect(right.className).toContain('px-2')
    expect(right.className).not.toContain('px-1.5')
    expect(right.className).toContain('h-12')
    expect(right.className).toContain('items-center')
    expect(right.className).toContain('gap-2')
    expect(header.className).toContain('justify-between')

    const last = required(right.children[right.children.length - 1], 'filter')

    expect(last.textContent).toContain('Filter')
  })
})

describe('image feed padding', () => {
  it('pads the overlay feed below the island at rest', () => {
    const { header } = renderIsland()
    const section = required(header.closest('section'), 'section')
    const scroller = required(section.querySelector<HTMLElement>('.overflow-y-auto'), 'scroll area')

    expect(scroller.style.paddingTop).toBe(`${String(IMAGE_FEED_TOP_PADDING)}px`)
    expect(IMAGE_FEED_TOP_PADDING).toBe(60)
  })
})
