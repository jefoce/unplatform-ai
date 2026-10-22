'use client'

import { isNil } from 'lodash-es'
import { create } from 'zustand'

interface SelectionState {
  // Selection order, also the order Shift ranges walk.
  ids: Set<string>

  /** Visible card order, set by HistorySection. */
  order: readonly string[]

  /** Last plain click, start of Shift ranges. */
  anchorId: string | null
  toggle: (id: string) => void

  /** Inclusive anchor..toId in visible order, adds, never removes. */
  selectRange: (toId: string) => void
  setOrder: (order: readonly string[]) => void
  setMany: (ids: readonly string[], on: boolean) => void
  clear: () => void

  /** Drops ids that no longer exist and an anchor that vanished. */
  prune: (existing: ReadonlySet<string>) => void
}

export const useSelectionStore = create<SelectionState>()((set, get) => ({
  ids: new Set(),
  order: [],
  anchorId: null,

  toggle: (id) =>
    set((state) => {
      const ids = new Set(state.ids)

      if (ids.has(id)) ids.delete(id)
      else ids.add(id)

      return { ids, anchorId: id }
    }),

  selectRange: (toId) => {
    const { anchorId, order } = get()
    const from = isNil(anchorId) ? -1 : order.indexOf(anchorId)
    const to = order.indexOf(toId)

    if (from === -1 || to === -1) {
      get().toggle(toId)

      return
    }

    const start = Math.min(from, to)
    const end = Math.max(from, to)

    set((state) => {
      const ids = new Set(state.ids)

      for (const id of order.slice(start, end + 1)) ids.add(id)

      return { ids }
    })
  },

  setOrder: (order) => set({ order }),

  setMany: (list, isOn) =>
    set((state) => {
      const ids = new Set(state.ids)

      for (const id of list) {
        if (isOn) ids.add(id)
        else ids.delete(id)
      }

      return { ids }
    }),

  clear: () => set({ ids: new Set(), anchorId: null }),

  prune: (existing) =>
    set((state) => {
      const ids = new Set([...state.ids].filter((id) => existing.has(id)))
      const anchorId =
        !isNil(state.anchorId) && state.anchorId !== '' && existing.has(state.anchorId)
          ? state.anchorId
          : null

      if (ids.size === state.ids.size && anchorId === state.anchorId) return state

      return { ids, anchorId }
    }),
}))
