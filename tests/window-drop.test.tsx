// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { isNil } from 'lodash-es'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { linkDroppedPaths } from '@/features/media-input/link-dropped'
import { WindowDropOverlay } from '@/features/media-input/WindowDropOverlay'
import { registerPickerAnchor } from '@/features/media-picker/picker/anchors'
import { MediaPicker } from '@/features/media-picker/picker/MediaPicker'
import { closeMediaPicker, openMediaPicker } from '@/features/media-picker/picker/store'
import { linkPaths } from '@/lib/platform/link-paths'
import { Modal } from '@/ui/Modal'

import { required } from './helpers/required'
import { upload } from './helpers/validation-fixtures'

const mocks = vi.hoisted(() => {
  return { toast: vi.fn(), linkPaths: vi.fn() }
})

vi.mock('sonner', () => {
  return { toast: mocks.toast }
})

vi.mock('@/lib/platform/link-paths', () => {
  return { linkPaths: mocks.linkPaths }
})

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function overlayElement(): HTMLElement {
  return required(screen.getByText('Drop to add').parentElement, 'overlay')
}

interface DockedHarnessProps {
  isDragging: boolean
}

function handlePanelRef(element: HTMLElement | null): (() => void) | undefined {
  if (isNil(element)) {
    return
  }

  return registerPickerAnchor('generator', element)
}

function DockedHarness(props: DockedHarnessProps) {
  const { isDragging } = props

  return (
    <>
      <aside ref={handlePanelRef} />
      <Modal open onOpenChange={vi.fn()} label="Settings">
        <span>Modal body</span>
      </Modal>
      <MediaPicker />
      <WindowDropOverlay isDragging={isDragging} hint="as references" />
    </>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  closeMediaPicker()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('WindowDropOverlay', () => {
  it('renders outside the app root as the last body child and hides after', () => {
    const view = render(<div data-testid="app-root" />)

    view.rerender(
      <>
        <div data-testid="app-root" />
        <WindowDropOverlay isDragging hint="as references" />
      </>,
    )

    const overlay = overlayElement()

    expect(document.body.lastElementChild).toBe(overlay)
    expect(view.container.contains(overlay)).toBe(false)
    expect(overlay.className).toContain('fixed')
    expect(overlay.className).toContain('inset-0')
    expect(overlay.className).toContain('pointer-events-auto')
    expect(overlay.style.zIndex).toBe('var(--z-drop)')
    expect(screen.getByText('as references')).toBeDefined()

    view.rerender(<div data-testid="app-root" />)

    expect(screen.queryByText('Drop to add')).toBeNull()
  })

  it('stays the last body child with a modal and the docked picker mounted', () => {
    vi.stubGlobal('matchMedia', () => {
      return {
        matches: true,
        addEventListener: () => {},
        removeEventListener: () => {},
      }
    })

    vi.stubGlobal('ResizeObserver', Observer)

    const view = render(<DockedHarness isDragging={false} />)

    act(() => {
      openMediaPicker({
        openerKey: 'test',
        kinds: ['image'],
        mode: { kind: 'pick', onPick: vi.fn() },
      })
    })

    expect(screen.getByText('Modal body')).toBeDefined()

    view.rerender(<DockedHarness isDragging />)

    expect(document.body.lastElementChild).toBe(overlayElement())
  })
})

describe('linkDroppedPaths', () => {
  const linked = upload('linked', 'image')

  beforeEach(() => {
    vi.mocked(linkPaths).mockResolvedValue([linked])
  })

  it('links accepted paths zero-copy', async () => {
    const items = await linkDroppedPaths({ paths: ['/tmp/a.png'], kinds: ['image'] })

    expect(linkPaths).toHaveBeenCalledWith(['/tmp/a.png'])
    expect(items).toEqual([linked])
    expect(mocks.toast).not.toHaveBeenCalled()
  })

  it('toasts the folder hint for a path without an extension', async () => {
    await linkDroppedPaths({ paths: ['/tmp/folder'], kinds: ['image'] })

    expect(mocks.toast).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenCalledWith('Folders: use Add folder')
    expect(linkPaths).toHaveBeenCalledWith([])
  })

  it('skips an unsupported extension with one toast', async () => {
    await linkDroppedPaths({ paths: ['/tmp/a.gif'], kinds: ['image'] })

    expect(mocks.toast).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenCalledWith('Skipped 1 unsupported file')
    expect(linkPaths).toHaveBeenCalledWith([])
  })
})
