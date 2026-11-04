/* eslint-disable max-lines -- workspace cases stay in one suite */

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { noop } from 'lodash-es'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useHistoryViewStore } from '@/features/history/list/view-store'
import { useHistoryViewerStore } from '@/features/shared/history-viewer-store'
import { setWorkspaceTab } from '@/features/shared/use-workspace-tab'
import { useImageViewStore } from '@/features/workspace/image-view-store'
import { ImageWorkspace } from '@/features/workspace/ImageWorkspace'
import { WorkspaceIsland } from '@/features/workspace/WorkspaceIsland'

import type { ImageRecord } from '../src/core/schemas/image-record'
import { imageItems } from '../src/lib/feed/output-items'
import { Observer } from './helpers/history'
import { required } from './helpers/required'

vi.mock('@/features/generator/credits/CreditsBadge', () => {
  return {
    CreditsBadge: () => {
      return <span>Credits</span>
    },
  }
})

const provider = vi.hoisted(() => {
  return { current: { isKeyMissing: false, isReady: true, reason: null as string | null } }
})

vi.mock('@/features/generator/use-provider-ready', () => {
  return {
    useProviderReady: () => {
      return provider.current
    },
  }
})

const FEED_PROPS = {
  isLoading: false,
  hasMore: false,
  isLoadingMore: false,
  error: undefined,
  loadMore: noop,
  onRetry: async () => {},
}

const RECORD: ImageRecord = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  status: 'completed',
  provider: 'openrouter',
  preset: { id: 'nano-banana-2', title: 'Nano Banana', slug: 'nano-banana-2' },
  input: {
    presetId: 'nano-banana-2',
    prompt: 'a cat',
    count: 2,
    aspectRatio: '1:1',
    resolution: '1K',
    quality: null,
    background: null,
    references: [],
    seed: null,
  },
  outputs: [
    {
      id: '3f2504e0-4f89-41d3-9a0c-0305e82c3302',
      index: 0,
      status: 'saved',
      file: 'image-0.png',
      mediaType: 'image/png',
      width: 1024,
      height: 1024,
      bytes: 1,
      favorite: true,
      seed: null,
    },
    {
      id: '3f2504e0-4f89-41d3-9a0c-0305e82c3303',
      index: 1,
      status: 'saved',
      file: 'image-1.png',
      mediaType: 'image/png',
      width: 1024,
      height: 1024,
      bytes: 1,
      favorite: false,
      seed: null,
    },
  ],
  seedUsed: null,
  cost: {
    currency: 'USD',
    unit: 'image',
    estimatedUsd: 0.02,
    actualUsd: 0.02,
    priceSource: 'mock',
    billed: true,
  },
}

const IMAGE_ITEMS = imageItems(RECORD)

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  useHistoryViewerStore.getState().close()
  vi.stubGlobal('ResizeObserver', Observer)
  vi.stubGlobal('IntersectionObserver', Observer)
  useHistoryViewStore.getState().setView('list')
  useHistoryViewStore.getState().setZoom(5)
  useHistoryViewStore.getState().resetFilters()
  useImageViewStore.getState().setView('grid')
  useImageViewStore.getState().setZoom(5)
  useImageViewStore.getState().resetFilters()
  provider.current = { isKeyMissing: false, isReady: true, reason: null }
})

afterEach(() => {
  cleanup()
  useHistoryViewerStore.getState().close()
  window.history.replaceState(null, '', '/')
  useHistoryViewStore.getState().resetFilters()
  useImageViewStore.getState().resetFilters()
  vi.unstubAllGlobals()
})

describe('workspace tab', () => {
  it('marks Settings with a red dot when the key is missing', () => {
    provider.current = {
      isKeyMissing: true,
      isReady: false,
      reason: 'Add your OpenRouter key in Settings.',
    }

    render(<WorkspaceIsland />)

    const settings = screen.getByRole('button', { name: /Settings/ })

    expect(settings.getAttribute('aria-label')).toBe('Settings, API key missing')
    expect(settings.querySelector('[data-key-missing]')).not.toBeNull()
  })

  it('reads and writes ?tab=image without a reload', () => {
    render(<WorkspaceIsland />)

    expect(screen.getByRole('tab', { name: 'Video' }).getAttribute('aria-selected')).toBe('true')

    fireEvent.click(screen.getByRole('tab', { name: 'Image' }))

    expect(window.location.search).toBe('?tab=image')
    expect(screen.getByRole('tab', { name: 'Image' }).getAttribute('aria-selected')).toBe('true')

    fireEvent.click(screen.getByRole('tab', { name: 'Video' }))

    expect(window.location.search).toBe('')
    expect(screen.getByRole('tab', { name: 'Video' }).getAttribute('aria-selected')).toBe('true')
  })
})

describe('image and video stores', () => {
  it('keeps view, zoom and filters apart', () => {
    useHistoryViewStore.getState().setView('list')
    useHistoryViewStore.getState().setZoom(1)
    useHistoryViewStore.getState().setFilters({ q: 'video query' })

    useImageViewStore.getState().setView('masonry')
    useImageViewStore.getState().setZoom(4)

    useImageViewStore.getState().setFilters({
      q: 'image query',
      favorite: true,
      presetId: 'nano-banana-2',
    })

    expect(useHistoryViewStore.getState().view).toBe('list')
    expect(useHistoryViewStore.getState().zoom).toBe(1)
    expect(useHistoryViewStore.getState().filters.q).toBe('video query')
    expect(useHistoryViewStore.getState().filters.favorite).toBeUndefined()

    expect(useImageViewStore.getState().view).toBe('masonry')
    expect(useImageViewStore.getState().zoom).toBe(4)
    expect(useImageViewStore.getState().filters.q).toBe('image query')
    expect(useImageViewStore.getState().filters.favorite).toBe(true)
    expect(useImageViewStore.getState().filters.presetId).toBe('nano-banana-2')

    useHistoryViewStore.getState().setFilters({ favorite: false })

    expect(useImageViewStore.getState().filters.favorite).toBe(true)
  })

  it('keeps both stores when the tab changes', () => {
    useHistoryViewStore.getState().setZoom(1)
    useImageViewStore.getState().setZoom(3)

    setWorkspaceTab('image')

    expect(useImageViewStore.getState().zoom).toBe(3)
    expect(useHistoryViewStore.getState().zoom).toBe(1)

    setWorkspaceTab('video')

    expect(useImageViewStore.getState().zoom).toBe(3)
    expect(useHistoryViewStore.getState().zoom).toBe(1)
  })
})

describe('island layout', () => {
  it('renders two independent glass surfaces inside a split header', () => {
    render(<WorkspaceIsland />)

    const header = required(
      screen.getByRole('tab', { name: 'Video' }).closest('header'),
      'island header',
    )

    expect(header.className).toContain('justify-between')
    expect(header.children).toHaveLength(2)

    const left = required(header.children[0], 'left surface')
    const right = required(header.children[1], 'right surface')

    for (const surface of [left, right]) {
      expect(surface.className).toContain('bg-glass-island')
      expect(surface.className).toContain('rounded-2xl')
      expect(surface.className).toContain('backdrop-blur-island')
    }

    expect(left.className).toContain('w-80')
    expect(right.className).not.toContain('w-80')
  })

  it('pins the left group to the panel width and keeps its order', () => {
    render(<WorkspaceIsland />)

    const header = required(
      screen.getByRole('tab', { name: 'Video' }).closest('header'),
      'island header',
    )

    const left = required(header.children[0], 'left group')

    expect(left.className).toContain('w-80')
    expect(left.className).toContain('shrink-0')
    expect(left.className).toContain('justify-between')
    expect(left.className).toContain('px-2')

    const tabs = required(left.children[0], 'tabs')

    expect(tabs.getAttribute('role')).toBe('tablist')
    expect(tabs.className).toContain('ml-1')
    expect(tabs.className).toContain('w-36')

    const cluster = required(left.children[1], 'right cluster')

    expect(cluster.className).toContain('items-center')
    expect(cluster.className).toContain('gap-1.5')
    expect(required(cluster.children[0], 'settings').getAttribute('aria-label')).toBe('Settings')
    expect(required(cluster.children[1], 'credits').textContent).toBe('Credits')
  })

  it('puts the size, type and filter controls last', () => {
    render(<WorkspaceIsland />)

    const header = required(
      screen.getByRole('tab', { name: 'Video' }).closest('header'),
      'island header',
    )

    const right = required(header.children[1], 'right group')
    const last = required(right.children[right.children.length - 1], 'filter')

    expect(right.className).toContain('items-center')
    expect(required(right.children[0], 'zoom').querySelector('[role="slider"]')).not.toBeNull()
    expect(last.textContent).toContain('Filter')
  })

  it('keeps the filter trigger a constant width with a reserved badge slot', () => {
    render(<WorkspaceIsland />)

    const trigger = screen.getByRole('button', { name: /Filter/ })

    expect(trigger.className).toContain('w-24')
    expect(trigger.querySelector('.min-w-4')).not.toBeNull()
  })
})

describe('image workspace', () => {
  it('renders the glass island and the image grid without a History title', () => {
    render(<ImageWorkspace items={IMAGE_ITEMS} {...FEED_PROPS} />)

    const island = screen.getByRole('tab', { name: 'Image' }).closest('header')?.firstElementChild

    expect(island?.className).toContain('bg-glass-island')
    expect(island?.className).toContain('backdrop-blur-island')
    expect(screen.queryByText('History')).toBeNull()
    expect(screen.queryByRole('tab', { name: 'List' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Open image details' })).toHaveLength(2)
  })

  it('mounts the prompt bar in the named slot', () => {
    render(<ImageWorkspace items={[]} {...FEED_PROPS} promptBar={<span>Prompt bar</span>} />)

    expect(screen.getByText('Prompt bar')).not.toBeNull()
    expect(screen.getByText('No images yet')).not.toBeNull()
  })

  it('restores the grid scroll after closing the viewer', () => {
    vi.useFakeTimers()

    try {
      const { container } = render(<ImageWorkspace items={IMAGE_ITEMS} {...FEED_PROPS} />)
      const scroller = required(container.querySelector('.overflow-y-auto'), 'scroll container')

      scroller.scrollTop = 100
      fireEvent.scroll(scroller)

      act(() => {
        useHistoryViewerStore.getState().open(required(IMAGE_ITEMS[0], 'image item').id)
      })

      act(() => {
        useHistoryViewerStore.getState().close()
      })

      // Radix focus restore still resets the scroller after the modal closes.
      scroller.scrollTop = 0

      act(() => {
        vi.advanceTimersByTime(0)
      })

      expect(scroller.scrollTop).toBe(100)

      scroller.scrollTop = 0

      act(() => {
        vi.advanceTimersByTime(120)
      })

      expect(scroller.scrollTop).toBe(100)
    } finally {
      vi.useRealTimers()
    }
  })
})
