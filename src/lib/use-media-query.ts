'use client'

import { useSyncExternalStore } from 'react'

/** Tracks a media query, true on the server to avoid layout flash. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query)

      list.addEventListener('change', notify)

      return () => {
        list.removeEventListener('change', notify)
      }
    },
    () => {
      return window.matchMedia(query).matches
    },
    () => {
      return true
    },
  )
}
