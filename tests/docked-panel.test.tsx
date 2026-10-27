// @vitest-environment jsdom
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DockedPanel } from '@/ui/DockedPanel'

const mocks = vi.hoisted(() => {
  return {
    useMediaQuery: vi.fn(),
  }
})

vi.mock('@/lib/use-media-query', () => {
  return {
    useMediaQuery: mocks.useMediaQuery,
  }
})

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const ANCHOR_RECT = {
  width: 600,
  height: 100,
  top: 0,
  left: 0,
  right: 600,
  bottom: 100,
  x: 0,
  y: 0,
  toJSON: () => {
    return {}
  },
}

interface HarnessProps {
  onOpenChange: (isOpen: boolean) => void
}

function Harness(props: HarnessProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  return (
    <>
      <aside id="generator-panel">
        <button ref={setAnchor} type="button">
          Generate
        </button>
        <button type="button">Panel</button>
      </aside>
      <button type="button">History</button>
      <DockedPanel open onOpenChange={props.onOpenChange} anchor={anchor} label="Choose media">
        <p>Picker body</p>
      </DockedPanel>
    </>
  )
}

function renderPanel() {
  const onOpenChange = vi.fn()

  render(<Harness onOpenChange={onOpenChange} />)

  return { onOpenChange }
}

async function settleDismissableLayer(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  })
}

beforeEach(() => {
  mocks.useMediaQuery.mockReturnValue(true)
  vi.stubGlobal('ResizeObserver', Observer)
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  mocks.useMediaQuery.mockReset()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('DockedPanel wide branch', () => {
  it('docks beside the opener at wide widths with a fixed height', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(ANCHOR_RECT)
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(800)
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(1000)
    renderPanel()

    const dialog = screen.getByRole('dialog')

    await waitFor(() => {
      expect(dialog.style.width).toBe('184px')
    })

    expect(dialog.style.height).toBe('720px')
    expect(dialog.parentElement?.dataset.radixPopperContentWrapper).toBe('')
    expect(dialog.className).toContain('backdrop-blur-xl')
  })

  it('keeps a fixed height at a tall viewport regardless of the opener height', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(ANCHOR_RECT)
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(2000)
    renderPanel()

    await waitFor(() => {
      expect(screen.getByRole('dialog').style.height).toBe('720px')
    })
  })

  it('shrinks the height with the viewport at a short viewport', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(ANCHOR_RECT)
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(500)
    renderPanel()

    await waitFor(() => {
      expect(screen.getByRole('dialog').style.height).toBe('468px')
    })
  })

  it('centers the panel vertically on the opener', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(ANCHOR_RECT)
    renderPanel()

    await waitFor(() => {
      expect(screen.getByRole('dialog').getAttribute('data-align')).toBe('center')
    })
  })

  it('stays open when the pointer goes down inside the opener', async () => {
    const { onOpenChange } = renderPanel()

    await settleDismissableLayer()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Generate' }), { button: 0 })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    await settleDismissableLayer()

    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('closes on a pointerdown inside the generator panel but outside the opener', async () => {
    const { onOpenChange } = renderPanel()

    await settleDismissableLayer()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Panel' }), { button: 0 })
    fireEvent.click(screen.getByRole('button', { name: 'Panel' }))

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('closes when the pointer goes down outside the opener', async () => {
    const { onOpenChange } = renderPanel()

    await settleDismissableLayer()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'History' }), { button: 0 })
    fireEvent.click(screen.getByRole('button', { name: 'History' }))

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })
})

describe('DockedPanel narrow branch', () => {
  it('falls back to the centered modal below 900 px', () => {
    mocks.useMediaQuery.mockReturnValue(false)
    renderPanel()

    const dialog = screen.getByRole('dialog')

    expect(dialog.className).toContain('h-[min(720px,85vh)]')
    expect(dialog.className).toContain('w-[min(900px,90vw)]')
    expect(document.querySelector('[data-radix-popper-content-wrapper]')).toBeNull()
  })
})
