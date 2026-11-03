'use client'

import { create } from 'zustand'

interface HistoryViewerState {
  selectedId: string | null
  open: (id: string) => void
  close: () => void
  navigate: (id: string) => void
}

/** Record shown in the history details viewer. Not persisted. */
export const useHistoryViewerStore = create<HistoryViewerState>((set) => {
  return {
    selectedId: null,
    open: (id) => {
      set({ selectedId: id })
    },
    close: () => {
      set({ selectedId: null })
    },
    navigate: (id) => {
      set({ selectedId: id })
    },
  }
})
