'use client'

import { useEffect } from 'react'

/** Mouse clicks do not leave buttons focused. Keyboard focus and menus are untouched. */
export function usePointerBlur(): void {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.detail === 0) return // keyboard activation (Enter, Space)

      const target = event.target instanceof Element ? event.target : null
      const control = target?.closest<HTMLElement>(
        'button, [role="button"], [role="checkbox"], [role="tab"], a[href]',
      )

      if (!control) return

      if (
        control.closest(
          '[role="menu"], [role="listbox"], [role="dialog"], [data-radix-popper-content-wrapper]',
        )
      ) {
        return
      }

      if (control.matches('[aria-haspopup], [aria-expanded="true"], [data-state="open"]')) return

      requestAnimationFrame(() => {
        if (document.activeElement === control) control.blur()
      })
    }

    document.addEventListener('click', onClick, true)

    return () => document.removeEventListener('click', onClick, true)
  }, [])
}
