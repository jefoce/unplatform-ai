'use client'

import { useEffect } from 'react'

import { DIALOG_SELECTOR } from '@/lib/dialog-keys'

const OPEN_LAYER_SELECTOR = `${DIALOG_SELECTOR}, [role="menu"]`

/** Clears the selection on Escape unless a dialog or menu is open. */
export function useSelectionEscape(onClear: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) {
        return
      }

      if (document.querySelector(OPEN_LAYER_SELECTOR)) {
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
