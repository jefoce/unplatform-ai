// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DetailsPanel } from '@/features/history/DetailsPanel'
import { HistoryGrid } from '@/features/history/HistoryGrid'
import { useSelectionStore } from '@/features/history/selection-store'
import { SelectionBar } from '@/features/history/SelectionBar'

import { handleNoop, ids, Observer, record, setOrder, setSelection, tile } from './helpers/history'
import { required } from './helpers/required'

const apiPost = vi.hoisted(() => vi.fn())
const apiDelete = vi.hoisted(() => vi.fn())
const confirm = vi.hoisted(() => vi.fn())

vi.mock('@/lib/fetcher', () => ({
  apiPost,
  apiDelete,
  apiPatch: vi.fn(),
  fetcher: vi.fn(),
  ApiError: class ApiError extends Error {
    status = 0
  },
}))

vi.mock('@/lib/platform', () => ({
  platform: { confirm, saveVideo: vi.fn(), saveVideos: vi.fn() },
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const RAW_ERROR = 'Provider said no.'
const MIXED_TITLE = 'Only finished videos can be downloaded or liked.'

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', Observer)
  vi.stubGlobal('ResizeObserver', Observer)
  useSelectionStore.getState().clear()
  apiPost.mockReset()
  apiDelete.mockReset()
  confirm.mockReset()
  confirm.mockResolvedValue(true)
})

afterEach(() => {
  cleanup()
  useSelectionStore.getState().clear()
  vi.unstubAllGlobals()
})

describe('selectable cards', () => {
  it('renders a checkbox for terminal records only', () => {
    const records = [
      record('done'),
      record('bad', { status: 'failed', error: RAW_ERROR }),
      record('cancelled', { status: 'cancelled' }),
      record('expired', { status: 'expired' }),
      record('active', { status: 'in_progress' }),
    ]

    setOrder(['done', 'bad', 'cancelled', 'expired'])
    const { container } = render(<HistoryGrid records={records} onOpen={handleNoop} />)

    expect(screen.getAllByRole('checkbox')).toHaveLength(4)
    expect(container.querySelector('#history-item-active [role="checkbox"]')).toBeNull()
  })

  it('ignores a click on an active card while selecting', () => {
    const records = [record('a'), record('b', { status: 'in_progress' })]

    setOrder(['a'])
    const { container } = render(<HistoryGrid records={records} onOpen={handleNoop} />)

    act(() => fireEvent.click(screen.getByRole('checkbox')))
    expect(ids()).toEqual(['a'])

    fireEvent.click(tile(container, 'b'))
    expect(ids()).toEqual(['a'])
  })

  it('skips active cards in a shift range', () => {
    const records = [record('a'), record('b', { status: 'in_progress' }), record('c')]

    setOrder(['a', 'c'])
    const { container } = render(<HistoryGrid records={records} onOpen={handleNoop} />)

    act(() =>
      fireEvent.click(
        required(
          container.querySelector<HTMLElement>('#history-item-a [role="checkbox"]'),
          'a box',
        ),
      ),
    )
    fireEvent.click(
      required(container.querySelector<HTMLElement>('#history-item-c [role="checkbox"]'), 'c box'),
      { shiftKey: true },
    )

    expect(ids()).toEqual(['a', 'c'])
  })
})

const REAL_PERSON_IMAGE = 'InputImageSensitiveContentDetected.PrivacyInformation: blocked'
const REAL_PERSON_VIDEO = 'InputVideoSensitiveContentDetected.PrivacyInformation: blocked'

describe('failed pill corner', () => {
  it('uses the same checkbox corner as completed cards and keeps the pill apart', () => {
    setOrder(['f'])
    const { container } = render(
      <HistoryGrid
        records={[record('f', { status: 'failed', error: RAW_ERROR })]}
        onOpen={handleNoop}
      />,
    )

    const wrapper = required(screen.getByRole('checkbox').parentElement, 'checkbox wrapper')

    expect(wrapper.className).toContain('z-30')
    expect(wrapper.className).toContain('left-3')
    expect(wrapper.className).toContain('top-3')

    const pillWrapper = required(
      container.querySelector<HTMLElement>('#history-item-f .absolute.z-30'),
      'failed pill',
    )

    expect(pillWrapper.className).toContain('left-4')
    expect(pillWrapper.className).toContain('top-4')
    expect(within(pillWrapper).getByText('Failed')).not.toBeNull()
    expect(within(pillWrapper).queryByRole('checkbox')).toBeNull()
  })

  it('shows the new hints and no Reuse with button for real-person errors', () => {
    render(
      <HistoryGrid
        records={[
          record('img', { status: 'failed', error: REAL_PERSON_IMAGE }),
          record('vid', { status: 'failed', error: REAL_PERSON_VIDEO }),
        ]}
        onOpen={handleNoop}
      />,
    )

    expect(screen.getByText('Use a different image, or choose another model.')).not.toBeNull()
    expect(screen.getByText('Use a different video, or choose another model.')).not.toBeNull()
    expect(screen.queryByText(/Reuse with/)).toBeNull()
  })

  it('keeps the pill and hides the checkbox on an active card', () => {
    render(<HistoryGrid records={[record('g', { status: 'in_progress' })]} onOpen={handleNoop} />)

    expect(screen.getByText('Generating')).not.toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})

describe('failed details panel', () => {
  it('shows Reuse and Details without the red error box', () => {
    render(<DetailsPanel record={record('f', { status: 'failed', error: RAW_ERROR })} />)

    expect(screen.getByRole('button', { name: 'Reuse' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Details' })).not.toBeNull()
    expect(screen.queryByText(RAW_ERROR)).toBeNull()
    expect(screen.queryByText('Generation failed')).toBeNull()
  })

  it('opens the raw monospace text plus Copy from Details', async () => {
    render(<DetailsPanel record={record('f', { status: 'failed', error: RAW_ERROR })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Details' }))

    const raw = await screen.findByText(RAW_ERROR)

    expect(raw.tagName).toBe('PRE')
    expect(raw.className).toContain('font-mono')
    expect(raw.className).toContain('text-xs')
    expect(screen.getByRole('button', { name: 'Copy' })).not.toBeNull()
  })
})

describe('details panel', () => {
  it('shows cost and total time for the row and the modal', () => {
    render(<DetailsPanel record={record('v')} />)

    expect(screen.getByText('Seedance')).not.toBeNull()
    expect(screen.getByText('$0.00')).not.toBeNull()
    expect(screen.getByText('0:00')).not.toBeNull()
  })
})

describe('mixed selection bar', () => {
  it('disables download and like, keeps delete working for both', async () => {
    const records = [record('a'), record('b', { status: 'failed', error: RAW_ERROR })]

    setOrder(['a', 'b'])
    setSelection(['a', 'b'])
    apiPost.mockResolvedValue({ done: ['a', 'b'], skipped: [] })
    render(<SelectionBar records={records} />)

    const download = screen.getByRole('button', { name: 'Download' })
    const like = screen.getByRole('button', { name: 'Like selected videos' })
    const remove = screen.getByRole('button', { name: 'Delete selected videos' })

    expect((download as HTMLButtonElement).disabled).toBe(true)
    expect((like as HTMLButtonElement).disabled).toBe(true)
    expect(download.getAttribute('title')).toBe(MIXED_TITLE)
    expect(like.getAttribute('title')).toBe(MIXED_TITLE)
    expect((remove as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(remove)

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/api/generations/batch', {
        action: 'delete',
        ids: ['a', 'b'],
      }),
    )
  })
})
