// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HistoryTile } from '@/features/history/list/HistoryTile'
import { ImageTileMedia } from '@/features/history/list/ImageTileMedia'
import { TILE_RADIUS } from '@/features/history/list/tile-radius'
import { VideoTileMedia } from '@/features/history/list/VideoTileMedia'
import { useSelectionStore } from '@/features/history/selection/selection-store'

import { ZOOM_DEFAULT } from '../src/core/constants'
import { type HistoryItem, videoItem } from '../src/lib/feed/output-items'
import { handleNoop, Observer, record, setOrder, setSelection } from './helpers/history'
import { imageItemsOf } from './helpers/image-history'
import { required } from './helpers/required'

vi.mock('@/lib/fetcher', () => {
  return {
    apiDelete: vi.fn(),
    apiPatch: vi.fn(),
    apiPost: vi.fn(),
    fetcher: vi.fn(),
    ApiError: class ApiError extends Error {
      status = 0
    },
  }
})

vi.mock('sonner', () => {
  return { toast: { success: vi.fn(), error: vi.fn() } }
})

type TileView = 'grid' | 'masonry'

interface RadiusCase {
  label: string
  kind: 'video' | 'image'
  view: TileView
  radius: string
}

const CASES: readonly RadiusCase[] = [
  {
    label: 'video grid',
    kind: 'video',
    view: 'grid',
    radius: 'rounded-2xl',
  },
  {
    label: 'image grid',
    kind: 'image',
    view: 'grid',
    radius: 'rounded-none',
  },
  {
    label: 'video masonry',
    kind: 'video',
    view: 'masonry',
    radius: 'rounded-none',
  },
  {
    label: 'image masonry',
    kind: 'image',
    view: 'masonry',
    radius: 'rounded-none',
  },
]

function itemOf(kind: RadiusCase['kind'], id: string): HistoryItem {
  if (kind === 'video') {
    return videoItem(record(id))
  }

  return required(imageItemsOf([id])[0], 'image item')
}

function mediaOf(tile: HTMLElement, kind: RadiusCase['kind']): HTMLElement {
  if (kind === 'image') {
    return required(tile.querySelector<HTMLImageElement>('img'), 'image media')
  }

  return required(tile.querySelector<HTMLElement>('div[class*="group/player"]'), 'video media')
}

beforeEach(() => {
  useSelectionStore.getState().clear()
  vi.stubGlobal('IntersectionObserver', Observer)
  vi.stubGlobal('ResizeObserver', Observer)
})

afterEach(() => {
  cleanup()
  useSelectionStore.getState().clear()
  vi.unstubAllGlobals()
})

describe('tile radius lookup', () => {
  it('is square in masonry and keyed by view then kind', () => {
    expect(TILE_RADIUS).toEqual({
      list: { image: 'rounded-none', video: 'rounded-2xl' },
      grid: { image: 'rounded-none', video: 'rounded-2xl' },
      masonry: { image: 'rounded-none', video: 'rounded-none' },
    })
  })
})

describe.each(CASES)('$label tile', (radiusCase) => {
  it('applies the lookup to the tile, ring, media and status overlay', () => {
    const id = 'a'

    setOrder([id])
    setSelection([id])

    const { container } = render(
      <HistoryTile
        item={itemOf(radiusCase.kind, id)}
        zoom={ZOOM_DEFAULT}
        onOpen={handleNoop}
        variant={radiusCase.view}
      />,
    )

    const tile = required(container.querySelector<HTMLElement>('[role="button"]'), 'tile')

    expect(tile.className).toContain(radiusCase.radius)

    const ring = required(tile.querySelector('[class*="border-2"]'), 'selection ring')

    expect(ring.className).toContain(radiusCase.radius)
    expect(mediaOf(container, radiusCase.kind).className).toContain(radiusCase.radius)
  })
})

describe('status overlay radius', () => {
  it('uses the image tile radius', () => {
    const [item] = imageItemsOf(['a'])

    const { container } = render(
      <ImageTileMedia
        item={required(item, 'image item')}
        thumbSrc={required(item, 'image item').thumbSrc}
        isCompleted={false}
        radius="rounded-none"
      />,
    )

    const overlay = required(container.firstElementChild, 'status overlay')

    expect(overlay.className).toContain('rounded-none')
  })

  it('uses the video tile radius', () => {
    const { container } = render(
      <VideoTileMedia
        item={videoItem(record('v', { status: 'failed' }))}
        poster=""
        isCompleted={false}
        isMasonry={false}
        radius="rounded-none"
      />,
    )

    const wrapper = required(container.firstElementChild, 'media wrapper')
    const overlay = required(wrapper.firstElementChild, 'status overlay')

    expect(overlay.className).toContain('rounded-none')
  })
})
