import { isNil } from 'lodash-es'
import type { RefObject } from 'react'

/** Cancels a queued animation frame and clears the ref that held it. */
export function cancelFrame(frameRef: RefObject<number | undefined>): void {
  if (isNil(frameRef.current)) {
    return
  }

  cancelAnimationFrame(frameRef.current)
  frameRef.current = undefined
}
