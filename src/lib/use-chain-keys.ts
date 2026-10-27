'use client'

import { type RefObject, useEffect } from 'react'

import { canHandleDialogKey } from '@/lib/dialog-keys'

interface UseChainKeysParams {
  isEnabled: boolean
  onPrevious: () => void
  onNext: () => void
  scopeRef: RefObject<HTMLElement | null>
}

/** Arrow key navigation for a modal item chain. */
export function useChainKeys(params: UseChainKeysParams): void {
  const { isEnabled, onPrevious, onNext, scopeRef } = params

  useEffect(() => {
    if (!isEnabled) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.shiftKey || !canHandleDialogKey(event, scopeRef.current)) {
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onPrevious()

        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        onNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isEnabled, onNext, onPrevious, scopeRef])
}
