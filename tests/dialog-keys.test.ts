// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import {
  canHandleDialogKey,
  DIALOG_SELECTOR,
  IGNORED_TARGETS,
  isIgnoredTarget,
  isTopmostDialog,
} from '@/lib/dialog-keys'

interface PressParams {
  isAltKey?: boolean
  isCtrlKey?: boolean
  isMetaKey?: boolean
  isShiftKey?: boolean
  target?: EventTarget
}

function press(params: PressParams = {}): KeyboardEvent {
  const {
    isAltKey = false,
    isCtrlKey = false,
    isMetaKey = false,
    isShiftKey = false,
    target = document.body,
  } = params

  const event = new KeyboardEvent('keydown', {
    key: 'ArrowLeft',
    altKey: isAltKey,
    ctrlKey: isCtrlKey,
    metaKey: isMetaKey,
    shiftKey: isShiftKey,
    bubbles: true,
    cancelable: true,
  })

  target.dispatchEvent(event)

  return event
}

function appendDialog(role: 'dialog' | 'alertdialog' = 'dialog'): HTMLElement {
  const dialog = document.createElement('div')

  dialog.setAttribute('role', role)
  document.body.append(dialog)

  return dialog
}

function appendScope(dialog: HTMLElement): HTMLElement {
  const scope = document.createElement('div')

  dialog.append(scope)

  return scope
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('isTopmostDialog', () => {
  it('is true only for the last dialog', () => {
    const first = appendScope(appendDialog())
    const second = appendScope(appendDialog())

    expect(document.querySelectorAll(DIALOG_SELECTOR)).toHaveLength(2)
    expect(isTopmostDialog(first)).toBe(false)
    expect(isTopmostDialog(second)).toBe(true)
  })

  it('is false outside any dialog', () => {
    expect(isTopmostDialog(document.createElement('div'))).toBe(false)
  })
})

describe('canHandleDialogKey', () => {
  it('rejects alt, ctrl and meta', () => {
    const scope = appendScope(appendDialog())

    expect(canHandleDialogKey(press({ isAltKey: true }), scope)).toBe(false)
    expect(canHandleDialogKey(press({ isCtrlKey: true }), scope)).toBe(false)
    expect(canHandleDialogKey(press({ isMetaKey: true }), scope)).toBe(false)
  })

  it('rejects an ignored input target', () => {
    const dialog = appendDialog()
    const scope = appendScope(dialog)
    const input = document.createElement('input')

    dialog.append(input)

    expect(input.matches(IGNORED_TARGETS)).toBe(true)
    expect(isIgnoredTarget(input)).toBe(true)
    expect(isIgnoredTarget(document.body)).toBe(false)
    expect(canHandleDialogKey(press({ target: input }), scope)).toBe(false)
  })

  it('keeps shift and plain keys', () => {
    const scope = appendScope(appendDialog())

    expect(canHandleDialogKey(press({ isShiftKey: true }), scope)).toBe(true)
    expect(canHandleDialogKey(press(), scope)).toBe(true)
  })
})
