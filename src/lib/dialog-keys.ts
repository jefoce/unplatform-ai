import { isNil } from 'lodash-es'

export const DIALOG_SELECTOR = '[role="dialog"], [role="alertdialog"]'

export const IGNORED_TARGETS = 'input, textarea, select, [contenteditable], [role="slider"]'

/** True when the scope sits in the last dialog of the document. */
export function isTopmostDialog(scope: HTMLElement | null): boolean {
  const dialog = scope?.closest(DIALOG_SELECTOR)

  if (isNil(dialog)) {
    return false
  }

  const dialogs = document.querySelectorAll(DIALOG_SELECTOR)

  return dialogs[dialogs.length - 1] === dialog
}

export function isIgnoredTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !isNil(target.closest(IGNORED_TARGETS))
}

/** Shared gate for keys that act inside the topmost dialog. Shift stays allowed. */
export function canHandleDialogKey(event: KeyboardEvent, scope: HTMLElement | null): boolean {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
    return false
  }

  return !isIgnoredTarget(event.target) && isTopmostDialog(scope)
}
