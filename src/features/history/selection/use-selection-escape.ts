'use client'

import { useEffect } from 'react'

/** Clears the selection on Escape unless a dialog or menu is open. */
export function useSelectionEscape(onClear: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) {
        return
      }

      if (document.querySelector('[role="dialog"],[role="menu"]')) {
        return
      }

      onClear()
    }

    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [onClear])
}
