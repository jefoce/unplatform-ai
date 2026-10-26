'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { isNil } from 'lodash-es'

type IntervalId = ReturnType<typeof setInterval>

const TICK_MS = 1000

const listeners = new Set<() => void>()
let now = Date.now()
let timer: IntervalId | undefined

function emit(): void {
  now = Date.now()

  for (const listener of listeners) {
    listener()
  }
}

function handleVisibility(): void {
  if (!document.hidden) {
    emit()
  }
}

function start(): void {
  if (!isNil(timer)) {
    return
  }

  now = Date.now()

  timer = setInterval(() => {
    if (!document.hidden) {
      emit()
    }
  }, TICK_MS)

  document.addEventListener('visibilitychange', handleVisibility)
}

function stop(): void {
  if (isNil(timer)) {
    return
  }

  clearInterval(timer)
  timer = undefined
  document.removeEventListener('visibilitychange', handleVisibility)
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    start()
  } else {
    handleVisibility()
  }

  listeners.add(listener)

  return () => {
    listeners.delete(listener)

    if (listeners.size === 0) {
      stop()
    }
  }
}

function getSnapshot(): number {
  return now
}

/**
 * Shared 1 s clock for active cards: one interval for all subscribers.
 * Paused while the page is hidden, refreshed on the first subscribe.
 */
export function useNow(isActive: boolean): number {
  const subscribeActive = useCallback(
    (listener: () => void) => {
      if (!isActive) {
        return () => {}
      }

      return subscribe(listener)
    },
    [isActive],
  )

  return useSyncExternalStore(subscribeActive, getSnapshot, getSnapshot)
}
