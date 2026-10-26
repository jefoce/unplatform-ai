// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HistoryGrid } from '@/features/history/list/HistoryGrid'
import { HistoryRow } from '@/features/history/list/HistoryRow'
import { useSelectionStore } from '@/features/history/selection/selection-store'
import { SelectionBar } from '@/features/history/selection/SelectionBar'

import { handleNoop, ids, Observer, record, setOrder, setSelection } from './helpers/history'
import { required } from './helpers/required'

const apiPost = vi.hoisted(() => {
  return vi.fn()
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
  return { toast: { success: vi.fn(), error: vi.fn() } }
})

const stack = () => {
  return screen.getByTestId('selection-stack').querySelectorAll('img')
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', Observer)
  vi.stubGlobal('ResizeObserver', Observer)
  useSelectionStore.getState().clear()
  apiPost.mockReset()
})

afterEach(() => {
  cleanup()
  useSelectionStore.getState().clear()
  vi.unstubAllGlobals()
})

describe('history selection cards', () => {
  it('does not render a check icon while unselected', () => {
    setOrder(['a'])
    render(<HistoryGrid records={[record('a')]} onOpen={handleNoop} />)

    const box = screen.getByRole('checkbox')

    expect(box.querySelector('svg')).toBeNull()
    expect(box.getAttribute('aria-checked')).toBe('false')
  })

  it('keeps the 1.5px white border unselected and the white fill selected', () => {
    setOrder(['a'])
    render(<HistoryGrid records={[record('a')]} onOpen={handleNoop} />)

    const box = screen.getByRole('checkbox')

    expect(box.className).toContain('border-[1.5px]')
    expect(box.className).toContain('border-white/90')

    act(() => {
      return fireEvent.click(box)
    })

    expect(box.getAttribute('aria-checked')).toBe('true')
    expect(box.className).toContain('bg-white')
  })

  it('hides card actions while selecting', () => {
    const records = ['a', 'b'].map((id) => {
      return record(id)
    })

    setOrder(
      records.map((item) => {
        return item.id
      }),
    )

    render(<HistoryGrid records={records} onOpen={handleNoop} />)

    act(() => {
      return fireEvent.click(required(screen.getAllByRole('checkbox')[0], 'checkbox'))
    })

    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
    expect(screen.queryByLabelText('Favorite')).toBeNull()
  })

  it('shows a player only on a selected list row while selecting', () => {
    const records = ['a', 'b'].map((id) => {
      return record(id)
    })

    setOrder(
      records.map((item) => {
        return item.id
      }),
    )

    setSelection(['b'])

    render(
      <div>
        <HistoryRow record={required(records[0], 'first record')} />
        <HistoryRow record={required(records[1], 'second record')} />
      </div>,
    )

    expect(screen.getAllByRole('button', { name: 'Play video' })).toHaveLength(1)
  })
})

describe('history selection rows', () => {
  it('keeps a selected list row selected when its media is clicked', () => {
    const item = record('a')

    setOrder(['a'])
    setSelection(['a'])
    const { container } = render(<HistoryRow record={item} />)

    fireEvent.click(required(container.querySelector('img'), 'poster'))

    expect(ids()).toEqual(['a'])
  })

  it('starts a range from the anchor when nothing is selected', () => {
    const records = ['a', 'b', 'c', 'd'].map((id) => {
      return record(id)
    })

    setOrder(
      records.map((item) => {
        return item.id
      }),
    )

    act(() => {
      useSelectionStore.getState().toggle('b')
      useSelectionStore.getState().toggle('b')
    })

    render(<HistoryGrid records={records} onOpen={handleNoop} />)

    const target = required(
      screen.getAllByRole('button', { name: 'Open video details' })[3],
      'fourth details button',
    )

    fireEvent.click(target, { shiftKey: true })

    expect(ids()).toEqual(['b', 'c', 'd'])
  })
})

describe('history selection bar', () => {
  it('keeps the bar width fixed for 1 and 200 selected', () => {
    const records = Array.from({ length: 200 }, (_, index) => {
      return record(`id-${index}`)
    })

    setOrder(
      records.map((item) => {
        return item.id
      }),
    )

    setSelection([required(records[0], 'first record').id])
    render(<SelectionBar records={records} />)

    const one = screen.getByText('1 selected')
    const countClass = one.className

    expect(countClass).toContain('w-24')
    expect(screen.getByText('Download').className).toContain('px-3.5')

    setSelection(
      records.slice(0, 3).map((item) => {
        return item.id
      }),
    )

    expect(screen.getByText('3 selected').className).toBe(countClass)

    setSelection(
      records.map((item) => {
        return item.id
      }),
    )

    expect(screen.getByText('200 selected').className).toBe(countClass)
    expect(screen.queryByText('Download 200')).toBeNull()
  })

  it('shows the last 3 selected thumbs, newest first', () => {
    const records = ['a', 'b', 'c', 'd'].map((id) => {
      return record(id)
    })

    setOrder(
      records.map((item) => {
        return item.id
      }),
    )

    setSelection(['a'])
    render(<SelectionBar records={records} />)

    expect(stack()).toHaveLength(1)

    setSelection(['b'])
    expect(stack()).toHaveLength(2)

    expect(
      [...stack()].map((img) => {
        return img.getAttribute('src')
      }),
    ).toEqual([expect.stringContaining('b.preview'), expect.stringContaining('a.preview')])

    setSelection(['c'])
    expect(stack()).toHaveLength(3)
    setSelection(['d'])
    expect(stack()).toHaveLength(3)

    expect(
      [...stack()].map((img) => {
        return img.getAttribute('src')
      }),
    ).toEqual([
      expect.stringContaining('d.preview'),
      expect.stringContaining('c.preview'),
      expect.stringContaining('b.preview'),
    ])
  })
})

describe('history selection batches', () => {
  it('does not clear on Escape while a dialog is open', () => {
    const records = ['a', 'b'].map((id) => {
      return record(id)
    })

    setSelection(['a', 'b'])
    render(<SelectionBar records={records} />)

    const dialog = document.createElement('div')

    dialog.setAttribute('role', 'dialog')
    document.body.append(dialog)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(ids()).toEqual(['a', 'b'])

    dialog.remove()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(ids()).toEqual([])
  })

  it('splits 250 ids into 2 batch requests', async () => {
    const records = Array.from({ length: 250 }, (_, index) => {
      return record(`id-${index}`)
    })

    setOrder(
      records.map((item) => {
        return item.id
      }),
    )

    setSelection(
      records.map((item) => {
        return item.id
      }),
    )

    apiPost.mockResolvedValue({ done: [], skipped: [] })
    render(<SelectionBar records={records} />)

    fireEvent.click(screen.getByRole('button', { name: 'Like selected videos' }))

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledTimes(2)
    })

    const sizes = apiPost.mock.calls
      .map((call) => {
        return (call[1] as { ids: string[] }).ids.length
      })
      .sort((a, b) => {
        return a - b
      })

    expect(sizes).toEqual([50, 200])
  })
})
