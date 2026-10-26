'use client'

import { type Dispatch, type SetStateAction, useEffect } from 'react'

interface PreviewKeysParams {
  isOpen: boolean
  length: number
  setIndex: Dispatch<SetStateAction<number>>
}

/** Left and right arrow navigation while the preview is open. */
export function usePreviewKeys(params: PreviewKeysParams): void {
  const { isOpen, length, setIndex } = params

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        setIndex((current) => {
          return Math.max(0, current - 1)
        })
      }

      if (event.key === 'ArrowRight') {
        setIndex((current) => {
          return Math.min(length - 1, current + 1)
        })
      }
    }

    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [isOpen, length, setIndex])
}
