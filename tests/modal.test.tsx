// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Modal } from '@/ui/Modal'

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
})

describe('Modal close button', () => {
  it('renders an accessible button that asks to close', () => {
    const handleOpenChange = vi.fn()

    render(
      <Modal open onOpenChange={handleOpenChange} label="Test" showClose>
        <span>Body</span>
      </Modal>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(handleOpenChange).toHaveBeenCalledWith(false)
  })

  it('keeps the close button reachable by Tab', () => {
    render(
      <Modal open onOpenChange={vi.fn()} label="Test" showClose>
        <span>Body</span>
      </Modal>,
    )

    const close = screen.getByRole('button', { name: 'Close' })

    expect(close.hasAttribute('disabled')).toBe(false)
    expect(close.getAttribute('tabindex')).not.toBe('-1')
  })

  it('renders no close button by default', () => {
    render(
      <Modal open onOpenChange={vi.fn()} label="Test">
        <span>Body</span>
      </Modal>,
    )

    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })
})

describe('Modal keep panels marker', () => {
  it('marks the dimmed overlay when keepPanels is set', () => {
    render(
      <Modal open onOpenChange={vi.fn()} label="Test" keepPanels>
        <span>Body</span>
      </Modal>,
    )

    const overlay = document.querySelector('[data-keep-panels].bg-backdrop')

    expect(overlay).not.toBeNull()
  })

  it('leaves the overlay unmarked without keepPanels', () => {
    render(
      <Modal open onOpenChange={vi.fn()} label="Test">
        <span>Body</span>
      </Modal>,
    )

    expect(document.querySelector('[data-keep-panels]')).toBeNull()
  })
})
