/* eslint-disable max-lines -- selection cases stay in one suite */

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HistoryGrid } from '@/features/history/list/HistoryGrid'
import { HistoryTile } from '@/features/history/list/HistoryTile'
import { useSelectionStore } from '@/features/history/selection/selection-store'
import { SelectionBar } from '@/features/history/selection/SelectionBar'

import { ZOOM_DEFAULT } from '../src/core/constants'
import type { HistoryItem } from '../src/lib/feed/output-items'
import { handleNoop, ids, items, Observer, record, setOrder, setSelection } from './helpers/history'
import { imageItemsOf } from './helpers/image-history'
import { required } from './helpers/required'

const apiPost = vi.hoisted(() => {
  return vi.fn()
})

const platformMock = vi.hoisted(() => {
  return {
    confirm: vi.fn(async () => {
      return true
    }),
    saveVideo: vi.fn(),
    saveVideos: vi.fn(),
    saveImages: vi.fn(),
  }
})

const toastMock = vi.hoisted(() => {
  return Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() })
})

vi.mock('@/lib/fetcher', () => {
  return {
    apiPost,
    apiPatch: vi.fn(),
    fetcher: vi.fn(),
    ApiError: class ApiError extends Error {
      status = 0
    },
  }
})

vi.mock('sonner', () => {
  return { toast: toastMock }
})

vi.mock('@/lib/platform', () => {
  return { platform: platformMock }
})

const stack = () => {
  return screen.getByTestId('selection-stack').querySelectorAll('img')
}

interface KindCase {
  kind: 'video' | 'image'
  makeItems: (ids: string[]) => HistoryItem[]
  openLabel: string
  noun: string
  thumbOf: (id: string) => string
  batchUrl: string
  batchSize: (call: unknown[]) => number
}

const VIDEO_CASE: KindCase = {
  kind: 'video',
  makeItems: (list) => {
    return items(
      list.map((id) => {
        return record(id)
      }),
    )
  },
  openLabel: 'Open video details',
  noun: 'videos',
  thumbOf: (id) => {
    return `${id}.preview`
  },
  batchUrl: '/api/generations/batch',
  batchSize: (call) => {
    return (call[1] as { ids: string[] }).ids.length
  },
}

const IMAGE_CASE: KindCase = {
  kind: 'image',
  makeItems: imageItemsOf,
  openLabel: 'Open image details',
  noun: 'images',
  thumbOf: (id) => {
    return `${id}.png`
  },
  batchUrl: '/api/images/batch',
  batchSize: (call) => {
    return (call[1] as { outputs: unknown[] }).outputs.length
  },
}

const KINDS = [VIDEO_CASE, IMAGE_CASE]

const ID_LIST = Array.from({ length: 250 }, (_, index) => {
  return `id-${index}`
})

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', Observer)
  vi.stubGlobal('ResizeObserver', Observer)
  useSelectionStore.getState().clear()
  apiPost.mockReset()
  platformMock.saveVideo.mockReset()
  platformMock.saveVideos.mockReset()
  platformMock.saveImages.mockReset()
  toastMock.mockReset()
})

afterEach(() => {
  cleanup()
  useSelectionStore.getState().clear()
  vi.unstubAllGlobals()
})

describe.each(KINDS)('$kind selection cards', (kind) => {
  it('does not render a check icon while unselected', () => {
    setOrder(['a'])
    render(<HistoryGrid items={kind.makeItems(['a'])} zoom={ZOOM_DEFAULT} onOpen={handleNoop} />)

    const box = screen.getByRole('checkbox')

    expect(box.querySelector('svg')).toBeNull()
    expect(box.getAttribute('aria-checked')).toBe('false')
  })

  it('keeps the 1.5px white border unselected and the white fill selected', () => {
    setOrder(['a'])
    render(<HistoryGrid items={kind.makeItems(['a'])} zoom={ZOOM_DEFAULT} onOpen={handleNoop} />)

    const box = screen.getByRole('checkbox')

    expect(box.className).toContain('border-[1.5px]')
    expect(box.className).toContain('border-white/90')

    act(() => {
      return fireEvent.click(box)
    })

    expect(box.getAttribute('aria-checked')).toBe('true')
    expect(box.className).toContain('bg-white')
  })

  it('is always round in the grid', () => {
    setOrder(['a'])
    render(<HistoryGrid items={kind.makeItems(['a'])} zoom={ZOOM_DEFAULT} onOpen={handleNoop} />)

    const box = screen.getByRole('checkbox')

    expect(box.className).toContain('rounded-full')
    expect(box.className).not.toContain('rounded-2xl')
    expect(box.className).not.toContain('rounded-none')
  })

  it('is always round in masonry', () => {
    setOrder(['a'])

    render(
      <HistoryTile
        item={required(kind.makeItems(['a'])[0], 'masonry item')}
        zoom={ZOOM_DEFAULT}
        onOpen={handleNoop}
        variant="masonry"
      />,
    )

    const box = screen.getByRole('checkbox')

    expect(box.className).toContain('rounded-full')
  })

  it('hides card actions while selecting', () => {
    setOrder(['a', 'b'])

    render(
      <HistoryGrid items={kind.makeItems(['a', 'b'])} zoom={ZOOM_DEFAULT} onOpen={handleNoop} />,
    )

    act(() => {
      return fireEvent.click(required(screen.getAllByRole('checkbox')[0], 'checkbox'))
    })

    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
    expect(screen.queryByLabelText('Like')).toBeNull()
  })

  it('starts a range from the anchor when nothing is selected', () => {
    setOrder(['a', 'b', 'c', 'd'])

    render(
      <HistoryGrid
        items={kind.makeItems(['a', 'b', 'c', 'd'])}
        zoom={ZOOM_DEFAULT}
        onOpen={handleNoop}
      />,
    )

    act(() => {
      useSelectionStore.getState().toggle('b')
      useSelectionStore.getState().toggle('b')
    })

    const target = required(
      screen.getAllByRole('button', { name: kind.openLabel })[3],
      'fourth details button',
    )

    fireEvent.click(target, { shiftKey: true })

    expect(ids()).toEqual(['b', 'c', 'd'])
  })
})

describe.each(KINDS)('$kind selection bar', (kind) => {
  it('keeps the bar width fixed for 1 and 200 selected', () => {
    const list = ID_LIST.slice(0, 200)

    setOrder(list)
    setSelection([required(list[0], 'first id')])
    render(<SelectionBar items={kind.makeItems(list)} />)

    const one = screen.getByText('1 selected')
    const countClass = one.className

    expect(countClass).toContain('w-24')

    expect(screen.getByRole('button', { name: 'Download 1' }).className).toContain('px-3.5')

    setSelection(list.slice(0, 3))
    expect(screen.getByText('3 selected').className).toBe(countClass)

    setSelection(list)
    expect(screen.getByText('200 selected').className).toBe(countClass)
    expect(screen.queryByRole('button', { name: /Like selected/ })).toBeNull()
  })

  it('shows the last 3 selected thumbs, newest first', () => {
    setOrder(['a', 'b', 'c', 'd'])
    setSelection(['a'])
    render(<SelectionBar items={kind.makeItems(['a', 'b', 'c', 'd'])} />)

    expect(stack()).toHaveLength(1)

    setSelection(['b'])
    expect(stack()).toHaveLength(2)

    expect(
      [...stack()].map((img) => {
        return img.getAttribute('src')
      }),
    ).toEqual([
      expect.stringContaining(kind.thumbOf('b')),
      expect.stringContaining(kind.thumbOf('a')),
    ])

    setSelection(['c'])
    expect(stack()).toHaveLength(3)
    setSelection(['d'])
    expect(stack()).toHaveLength(3)

    expect(
      [...stack()].map((img) => {
        return img.getAttribute('src')
      }),
    ).toEqual([
      expect.stringContaining(kind.thumbOf('d')),
      expect.stringContaining(kind.thumbOf('c')),
      expect.stringContaining(kind.thumbOf('b')),
    ])
  })
})

describe.each(KINDS)('$kind selection batches', (kind) => {
  it.each(['dialog', 'alertdialog', 'menu'] as const)(
    'does not clear on Escape while a %s is open',
    (role) => {
      setSelection(['a', 'b'])
      render(<SelectionBar items={kind.makeItems(['a', 'b'])} />)

      const layer = document.createElement('div')

      layer.setAttribute('role', role)
      document.body.append(layer)
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(ids()).toEqual(['a', 'b'])
      layer.remove()
    },
  )

  it('clears on Escape without an open layer', () => {
    setSelection(['a', 'b'])
    render(<SelectionBar items={kind.makeItems(['a', 'b'])} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(ids()).toEqual([])
  })

  it('splits 250 ids into 2 batch requests', async () => {
    setOrder(ID_LIST)
    setSelection(ID_LIST)
    apiPost.mockResolvedValue({ done: [], skipped: [] })
    render(<SelectionBar items={kind.makeItems(ID_LIST)} />)

    fireEvent.click(screen.getByRole('button', { name: `Delete selected ${kind.noun}` }))

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledTimes(2)
    })

    expect(apiPost.mock.calls[0]?.[0]).toBe(kind.batchUrl)

    const sizes = apiPost.mock.calls
      .map((call) => {
        return kind.batchSize(call)
      })
      .sort((a, b) => {
        return a - b
      })

    expect(sizes).toEqual([50, 200])
  })
})

describe('video mixed selection', () => {
  it('downloads only the finished video and reports the skip count', async () => {
    const records = [
      record('done'),
      record('bad', { status: 'failed', error: 'Provider said no.' }),
      record('active', { status: 'in_progress' }),
    ]

    setOrder(['done', 'bad'])
    setSelection(['done', 'bad'])
    platformMock.saveVideos.mockResolvedValue({ saved: 1, skipped: 0 })
    render(<SelectionBar items={items(records)} />)

    fireEvent.click(screen.getByRole('button', { name: 'Download 1' }))

    await waitFor(() => {
      expect(platformMock.saveVideos).toHaveBeenCalledTimes(1)
    })

    expect(platformMock.saveVideos).toHaveBeenCalledWith([expect.objectContaining({ id: 'done' })])

    expect(platformMock.saveVideo).not.toHaveBeenCalled()
    expect(toastMock).toHaveBeenCalledWith('1 not finished, skipped')
  })
})
