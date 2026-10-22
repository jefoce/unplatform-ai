// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePointerBlur } from '@/lib/use-pointer-blur'

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)

    return 1
  })
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

function mountControl(attributes: Record<string, string> = {}): HTMLElement {
  const button = document.createElement('button')

  for (const [name, value] of Object.entries(attributes)) button.setAttribute(name, value)

  document.body.append(button)

  return button
}

function click(element: HTMLElement, detail = 1): void {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, detail }))
}

describe('usePointerBlur', () => {
  it('drops focus after a mouse click', () => {
    renderHook(() => usePointerBlur())
    const button = mountControl()

    button.focus()

    click(button)

    expect(document.activeElement).toBe(document.body)
  })

  it('keeps focus on menu triggers', () => {
    renderHook(() => usePointerBlur())
    const button = mountControl({ 'aria-haspopup': 'menu' })

    button.focus()

    click(button)

    expect(document.activeElement).toBe(button)
  })

  it('keeps focus for keyboard activation', () => {
    renderHook(() => usePointerBlur())
    const button = mountControl()

    button.focus()

    click(button, 0)

    expect(document.activeElement).toBe(button)
  })

  it('keeps focus inside an open menu', () => {
    renderHook(() => usePointerBlur())
    const menu = document.createElement('div')

    menu.setAttribute('role', 'menu')
    const item = document.createElement('button')

    menu.append(item)
    document.body.append(menu)
    item.focus()

    click(item)

    expect(document.activeElement).toBe(item)
  })
})
