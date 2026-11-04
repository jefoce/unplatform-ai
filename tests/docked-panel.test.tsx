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
  isAnchored?: boolean
  hasExtraAnchor?: boolean
  placement?: 'right' | 'top'
}

function Harness(props: HarnessProps) {
  const { onOpenChange, isAnchored = true, hasExtraAnchor = false, placement } = props

  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [extraAnchor, setExtraAnchor] = useState<HTMLElement | null>(null)

  return (
    <>
      <aside>
        <button ref={setAnchor} type="button">
          Generate
        </button>
        <button ref={setExtraAnchor} type="button">
          References
        </button>
        <button type="button">Panel</button>
      </aside>
      <button type="button">History</button>
      <DockedPanel
        open
        onOpenChange={onOpenChange}
        anchor={isAnchored ? anchor : null}
        extraAnchors={hasExtraAnchor ? [extraAnchor] : []}
        placement={placement}
        label="Choose media"
      >
        <p>Picker body</p>
      </DockedPanel>
    </>
  )
}

function renderPanel(options: Partial<HarnessProps> = {}) {
  const onOpenChange = vi.fn()

  render(<Harness onOpenChange={onOpenChange} {...options} />)

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
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1280)
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(1000)
    renderPanel()

    const dialog = screen.getByRole('dialog')

    await waitFor(() => {
      expect(dialog.style.width).toBe('560px')
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

  it('falls back to the centered modal when the caller has no anchor', () => {
    render(<Harness onOpenChange={vi.fn()} isAnchored={false} />)

    const dialog = screen.getByRole('dialog')

    expect(dialog.className).toContain('h-[min(720px,85vh)]')
    expect(dialog.className).toContain('w-[min(900px,90vw)]')
    expect(document.querySelector('[data-radix-popper-content-wrapper]')).toBeNull()
  })

  it('stays open when the pointer goes down inside the opener', async () => {
    const { onOpenChange } = renderPanel()

    await settleDismissableLayer()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Generate' }), { button: 0 })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    await settleDismissableLayer()

    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('stays open when the pointer goes down inside a second anchor', async () => {
    const { onOpenChange } = renderPanel({ hasExtraAnchor: true })

    await settleDismissableLayer()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'References' }), { button: 0 })
    fireEvent.click(screen.getByRole('button', { name: 'References' }))
    await settleDismissableLayer()

    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('closes on a pointerdown inside the panel but outside the opener', async () => {
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

describe('DockedPanel top placement', () => {
  it('docks above the opener at the panel width', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      ...ANCHOR_RECT,
      width: 320,
      top: 500,
      right: 320,
    })

    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1000)
    renderPanel({ placement: 'top' })

    const dialog = screen.getByRole('dialog')

    await waitFor(() => {
      expect(dialog.style.width).toBe('560px')
    })

    expect(dialog.style.height).toBe('476px')
    expect(dialog.getAttribute('data-side')).toBe('top')
    expect(dialog.getAttribute('data-align')).toBe('center')
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
