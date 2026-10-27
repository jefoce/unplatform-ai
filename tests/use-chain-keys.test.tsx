// @vitest-environment jsdom
import { type RefObject } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest'

import { useChainKeys } from '@/lib/use-chain-keys'

interface PressParams {
  key: string
  isShiftKey?: boolean
  isPrevented?: boolean
  target?: EventTarget
}

function press(params: PressParams): KeyboardEvent {
  const { key, isShiftKey = false, isPrevented = false, target = document.body } = params

  const event = new KeyboardEvent('keydown', {
    key,
    shiftKey: isShiftKey,
    bubbles: true,
    cancelable: true,
  })

  if (isPrevented) {
    event.preventDefault()
  }

  act(() => {
    target.dispatchEvent(event)
  })

  return event
}

function appendDialog(role: 'dialog' | 'alertdialog' = 'dialog'): HTMLElement {
  const dialog = document.createElement('div')

  dialog.setAttribute('role', role)
  document.body.append(dialog)

  return dialog
}

interface ChainHandlers {
  onPrevious: Mock
  onNext: Mock
}

function renderScopedKeys(scope: HTMLElement, isEnabled = true): ChainHandlers {
  const onPrevious = vi.fn()
  const onNext = vi.fn()
  const scopeRef: RefObject<HTMLElement | null> = { current: scope }

  renderHook(() => {
    useChainKeys({ isEnabled, onPrevious, onNext, scopeRef })
  })

  return { onPrevious, onNext }
}

function renderKeys(isEnabled = true): ChainHandlers {
  const dialog = appendDialog()
  const scope = document.createElement('div')

  dialog.append(scope)

  return renderScopedKeys(scope, isEnabled)
}

function expectIgnored(target: EventTarget): void {
  const dialog = appendDialog()
  const scope = document.createElement('div')

  dialog.append(scope)

  if (target instanceof Node) {
    dialog.append(target)
  }

  const { onPrevious, onNext } = renderScopedKeys(scope)
  const event = press({ key: 'ArrowLeft', target })

  expect(onPrevious).not.toHaveBeenCalled()
  expect(onNext).not.toHaveBeenCalled()
  expect(event.defaultPrevented).toBe(false)

  cleanup()
  document.body.replaceChildren()
}

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
})

describe('useChainKeys', () => {
  it('moves to the previous and next item on arrows', () => {
    const { onPrevious, onNext } = renderKeys()
    const left = press({ key: 'ArrowLeft' })
    const right = press({ key: 'ArrowRight' })

    expect(onPrevious).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(left.defaultPrevented).toBe(true)
    expect(right.defaultPrevented).toBe(true)
  })

  it('does nothing while disabled', () => {
    const { onPrevious, onNext } = renderKeys(false)
    const event = press({ key: 'ArrowLeft' })

    expect(onPrevious).not.toHaveBeenCalled()
    expect(onNext).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('ignores a modified arrow', () => {
    const { onPrevious, onNext } = renderKeys()
    const event = press({ key: 'ArrowLeft', isShiftKey: true })

    expect(onPrevious).not.toHaveBeenCalled()
    expect(onNext).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('ignores an already prevented event', () => {
    const { onPrevious } = renderKeys()
    const event = press({ key: 'ArrowLeft', isPrevented: true })

    expect(onPrevious).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it('ignores input, textarea and slider targets', () => {
    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    const slider = document.createElement('div')

    slider.setAttribute('role', 'slider')

    expectIgnored(input)
    expectIgnored(textarea)
    expectIgnored(slider)
  })
})

describe('useChainKeys topmost dialog', () => {
  it('ignores keys while a later dialog exists and handles them after it closes', () => {
    const first = appendDialog()
    const second = appendDialog()
    const scope = document.createElement('div')

    first.append(scope)

    const { onNext } = renderScopedKeys(scope)

    press({ key: 'ArrowRight' })

    expect(onNext).not.toHaveBeenCalled()

    second.remove()
    press({ key: 'ArrowRight' })

    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('lets a trailing alert dialog block the modal behind', () => {
    const dialog = appendDialog()
    const scope = document.createElement('div')

    dialog.append(scope)

    const { onNext } = renderScopedKeys(scope)

    appendDialog('alertdialog')
    press({ key: 'ArrowRight' })

    expect(onNext).not.toHaveBeenCalled()
  })

  it('handles keys when the scope sits in an alert dialog', () => {
    const dialog = appendDialog('alertdialog')
    const scope = document.createElement('div')

    dialog.append(scope)

    const { onNext } = renderScopedKeys(scope)

    press({ key: 'ArrowRight' })

    expect(onNext).toHaveBeenCalledTimes(1)
  })
})
