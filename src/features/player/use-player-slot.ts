'use client'

import { useSyncExternalStore } from 'react'

import { acquire, getSnapshot, isActive, release, subscribe } from './player-slots'

export interface PlayerSlot {
  active: string[]
  acquire: (id: string) => void
  release: (id: string) => void
  isActive: (id: string) => boolean
}

/** Subscribes to the global max-two-player slot state. */
export function usePlayerSlot(): PlayerSlot {
  const active = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  // Module-level handlers are stable across renders.
  return { active, acquire, release, isActive }
}
