// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AspectRatioPopover } from '@/features/generator/options/AspectRatioPopover'
import { DurationPopover } from '@/features/generator/options/DurationPopover'
import { ResolutionPopover } from '@/features/generator/options/ResolutionPopover'
import { useGeneratorStore } from '@/features/generator/store/store'

vi.mock('sonner', () => {
  return { toast: { success: vi.fn(), error: vi.fn() } }
})

vi.mock('@/lib/api/models', () => {
  return {
    useModelEntry: () => {
      return null
    },
  }
})

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer)

  useGeneratorStore.setState({
    presetId: 'wan-3.0',
    tab: 'frames',
    prompts: { frames: '', references: '' },
    audio: true,
    duration: 5,
    aspectRatio: '16:9',
    resolution: '1080p',
    frames: { start: null, end: null },
    references: [],
    uploadsById: {},
    seed: null,
  })
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function open(label: string): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: label }))

  return screen.getByRole('dialog')
}

function expectClosed(): Promise<void> {
  return waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull()
  })
}

describe('single-choice pickers close on pick', () => {
  it('closes the duration popover after a quick chip', async () => {
    render(<DurationPopover />)
    const dialog = open('5s')

    fireEvent.click(within(dialog).getByRole('button', { name: '10s' }))

    expect(useGeneratorStore.getState().duration).toBe(10)
    await expectClosed()
  })

  it('keeps the duration popover open while the slider drags and releases', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 260,
      height: 20,
      left: 0,
      top: 0,
      right: 260,
      bottom: 20,
      x: 0,
      y: 0,
      toJSON: () => {
        return {}
      },
    })

    render(<DurationPopover />)
    const dialog = open('5s')
    const thumb = within(dialog).getByRole('slider')

    Object.assign(thumb, {
      setPointerCapture: vi.fn(),
      hasPointerCapture: () => {
        return true
      },
      releasePointerCapture: vi.fn(),
    })

    fireEvent.pointerDown(thumb, { button: 0, pointerId: 1, clientX: 0 })
    fireEvent.pointerMove(thumb, { pointerId: 1, clientX: 130 })
    fireEvent.pointerUp(thumb, { pointerId: 1, clientX: 130 })

    expect(useGeneratorStore.getState().duration).toBeGreaterThan(5)
    expect(screen.getByRole('dialog')).toBe(dialog)
  })

  it('closes the aspect ratio popover after a pick', async () => {
    render(<AspectRatioPopover />)
    const dialog = open('16:9')

    fireEvent.click(within(dialog).getByRole('button', { name: '4:3' }))

    expect(useGeneratorStore.getState().aspectRatio).toBe('4:3')
    await expectClosed()
  })

  it('closes the resolution popover after a pick', async () => {
    render(<ResolutionPopover />)
    const dialog = open('1080p')

    fireEvent.click(within(dialog).getByRole('button', { name: /^720p/ }))

    expect(useGeneratorStore.getState().resolution).toBe('720p')
    await expectClosed()
  })
})
