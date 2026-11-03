'use client'

import { useRef } from 'react'

interface PointerCloseFocus {
  handlePointerDownOutside: () => void
  handleCloseAutoFocus: (event: Event) => void
}

/** Returns focus to the trigger on keyboard close and keeps it put on pointer close. */
export function usePointerCloseFocus(): PointerCloseFocus {
  const isPointerClose = useRef(false)

  const handlePointerDownOutside = (): void => {
    isPointerClose.current = true
  }

  const handleCloseAutoFocus = (event: Event): void => {
    if (!isPointerClose.current) {
      return
    }

    isPointerClose.current = false
    event.preventDefault()
  }

  return { handlePointerDownOutside, handleCloseAutoFocus }
}
