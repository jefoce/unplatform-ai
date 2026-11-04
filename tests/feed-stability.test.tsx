// @vitest-environment jsdom
import { cleanup, render, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MasonryGrid } from '@/features/history/list/MasonryGrid'
import { useStableItems } from '@/features/history/list/use-stable-items'

import type * as JustifyModule from '../src/core/feed/justify-rows'
import { justifyRows } from '../src/core/feed/justify-rows'
import type { HistoryItem, VideoGridItem } from '../src/lib/feed/output-items'
import { handleNoop, item, Observer } from './helpers/history'

vi.mock('@/core/feed/justify-rows', async (importOriginal) => {
  const actual = await importOriginal<typeof JustifyModule>()

  return { ...actual, justifyRows: vi.fn(actual.justifyRows) }
})

const justifySpy = vi.mocked(justifyRows)

const movedVideo = (entry: VideoGridItem): VideoGridItem => {
  return {
    ...entry,
    source: { ...entry.source, updatedAt: '2026-01-02T00:00:00.000Z' },
  }
}

beforeEach(() => {
  justifySpy.mockClear()
  vi.stubGlobal('ResizeObserver', Observer)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useStableItems', () => {
  it('keeps the previous array while the layout values stay the same', () => {
    const initial = [item('a'), item('b')]

    const { result, rerender } = renderHook(
      (props: { items: HistoryItem[] }) => {
        return useStableItems(props.items)
      },
      { initialProps: { items: initial } },
    )

    const first = result.current

    const cloned = initial.map((entry) => {
      return { ...entry, source: { ...entry.source } }
    })

    rerender({ items: cloned })

    expect(result.current).toBe(first)

    rerender({
      items: initial.map((entry, index) => {
        return index === 0 ? movedVideo(entry) : entry
      }),
    })

    expect(result.current).not.toBe(first)
  })
})

interface StableMasonryProps {
  items: HistoryItem[]
}

function StableMasonry(props: StableMasonryProps) {
  const items = useStableItems(props.items)

  return <MasonryGrid items={items} zoom={5} onOpen={handleNoop} />
}

describe('MasonryGrid stability', () => {
  it('keeps the layout for an identical poll and rebuilds for a changed record', () => {
    const initial = ['a', 'b', 'c'].map((id) => {
      return item(id)
    })

    const view = render(<StableMasonry items={initial} />)
    const calls = justifySpy.mock.calls.length

    const cloned = initial.map((entry) => {
      return { ...entry, source: { ...entry.source } }
    })

    view.rerender(<StableMasonry items={cloned} />)

    expect(justifySpy).toHaveBeenCalledTimes(calls)

    const changed = initial.map((entry, index) => {
      return index === 0 ? movedVideo(entry) : entry
    })

    view.rerender(<StableMasonry items={changed} />)

    expect(justifySpy).toHaveBeenCalledTimes(calls + 1)
  })
})
