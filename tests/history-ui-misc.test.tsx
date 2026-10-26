// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AudioChip } from '@/features/generator/options/AudioChip'
import { SeedChip } from '@/features/generator/options/SeedChip'
import { PromptWarnings } from '@/features/generator/prompt/PromptWarnings'
import { HistoryGrid } from '@/features/history/list/HistoryGrid'
import { HistoryRow } from '@/features/history/list/HistoryRow'
import { useSelectionStore } from '@/features/history/selection/selection-store'
import { StatusOverlay } from '@/features/history/status/StatusOverlay'

import { handleNoop, ids, Observer, record, setOrder, setSelection, tile } from './helpers/history'
import { required } from './helpers/required'

const apiPost = vi.hoisted(() => {
  return vi.fn()
})

const apiDelete = vi.hoisted(() => {
  return vi.fn()
})

const confirm = vi.hoisted(() => {
  return vi.fn()
})

vi.mock('@/lib/fetcher', () => {
  return {
    apiPost,
    apiDelete,
    apiPatch: vi.fn(),
    fetcher: vi.fn(),
    ApiError: class ApiError extends Error {
      status = 0
    },
  }
})

vi.mock('@/lib/platform', () => {
  return {
    platform: { confirm, saveVideo: vi.fn(), saveVideos: vi.fn() },
  }
})

vi.mock('sonner', () => {
  return { toast: { success: vi.fn(), error: vi.fn() } }
})

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

describe('portal clicks', () => {
  it('does not open a tile from a More menu item', async () => {
    const handleOpenMock = vi.fn()

    render(<HistoryGrid records={[record('a')]} onOpen={handleOpenMock} />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'More actions' }), {
      button: 0,
      ctrlKey: false,
    })

    fireEvent.click(await screen.findByRole('menuitem', { name: 'Copy prompt' }))

    expect(handleOpenMock).not.toHaveBeenCalled()
  })

  it('does not toggle row selection from the delete dialog', async () => {
    setOrder(['a', 'b'])
    setSelection(['a'])
    apiDelete.mockResolvedValue(undefined)
    render(<HistoryRow record={record('b')} />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'More actions' }), {
      button: 0,
      ctrlKey: false,
    })

    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))

    const dialog = await screen.findByRole('dialog')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith('/api/generations/b')
    })

    expect(ids()).toEqual(['a'])
  })

  it('keeps heart, download and more interactive after the pointer leaves', async () => {
    const { container } = render(<HistoryGrid records={[record('a')]} onOpen={handleNoop} />)
    const card = tile(container, 'a')
    const menu = within(card).getByRole('button', { name: 'More actions' })

    fireEvent.pointerDown(menu, { button: 0, ctrlKey: false })
    await screen.findByRole('menuitem', { name: 'Copy prompt' })
    fireEvent.pointerLeave(card)

    const open = 'group-has-[[data-card-menu][data-state=open]]/card:pointer-events-auto'

    for (const name of ['Favorite', 'Download', 'More actions']) {
      expect(within(card).getByRole('button', { name, hidden: true }).className).toContain(open)
    }
  })
})

describe('prompt chips', () => {
  it('gives warning, audio and seed the same height, padding and text classes', () => {
    render(
      <>
        <AudioChip />
        <SeedChip />
        <PromptWarnings warnings={[{ type: 'text', text: 'Note' }]} />
      </>,
    )

    const chips = [
      screen.getByRole('button', { name: '1 prompt warnings' }),
      screen.getByRole('button', { name: 'On' }),
      screen.getByRole('button', { name: 'Random' }),
    ]

    for (const chip of chips) {
      expect(chip.className).toContain('h-6')
      expect(chip.className).toContain('px-1.5')
      expect(chip.className).toContain('gap-1.5')
      expect(chip.className).toContain('text-xs/4')
      expect(chip.className).toContain('rounded-lg')
      expect(chip.className).toContain('font-medium')
    }

    expect(required(chips[0], 'warning chip').className).toContain('ml-auto')
  })
})

describe('cancel fade', () => {
  it('fades the Cancel button over the remaining grace, then drops it', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-01-01T00:00:00.000Z'))

    const graced = record('grace', {
      status: 'submitting',
      submit: { stage: 'grace', notBefore: '2026-01-01T00:00:04.000Z' },
    })

    const handleCancel = vi.fn()

    const { container, rerender } = render(
      <StatusOverlay record={graced} onCancel={handleCancel} />,
    )

    const button = screen.getByRole('button', { name: 'Cancel' })

    expect(button.style.animationDuration).toBe('4000ms')
    expect(button.className).toContain('grace-fade')
    expect(container.querySelector('svg.-rotate-90')).toBeNull()

    fireEvent.focus(button)
    const tooltip = await screen.findByRole('tooltip')

    expect(tooltip.textContent).toBe(
      'Sends to OpenRouter in 4 s. Cancel now and nothing is sent or charged.',
    )

    rerender(
      <StatusOverlay
        record={{ ...graced, submit: { stage: 'grace', notBefore: '2025-12-31T23:59:59.000Z' } }}
        onCancel={handleCancel}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
    nowSpy.mockRestore()
  })
})

describe('liked list row', () => {
  it('pins the heart without the count pill or a lower stack', () => {
    const { container } = render(<HistoryRow record={record('a', { favorite: true })} />)
    const row = required(container.firstElementChild, 'row')
    const media = required(row.firstElementChild, 'media') as HTMLElement

    const hearts = within(media).getAllByRole('button', { name: 'Remove favorite' })

    expect(hearts).toHaveLength(1)
    expect(within(media).queryByText('1')).toBeNull()

    const heart = required(hearts[0], 'heart')

    expect(heart.className).not.toContain('opacity-0')

    const stack = required(heart.parentElement, 'heart stack')

    expect(stack.className).toContain('top-3')
    expect(stack.className).not.toContain('top-[52px]')
  })
})
