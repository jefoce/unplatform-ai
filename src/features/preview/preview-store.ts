'use client'

import { create } from 'zustand'

import type { UploadItem } from '@/core/schemas/upload-item'

/** Upload item plus a read-only ref for files not linked yet. */
export interface PreviewItem extends UploadItem {
  previewRef?: string

  /** Connected folder root, set only on unlinked folder previews. */
  folderPath?: string
}

export type ActionKey = keyof Omit<PreviewActions, 'available' | 'label' | 'isSelected'>

export interface PreviewActions {
  insert?: (item: UploadItem) => void | boolean
  replace?: (item: UploadItem) => void | boolean
  remove?: (item: UploadItem) => void | boolean
  select?: (item: UploadItem) => void | boolean
  deselect?: (item: UploadItem) => void | boolean
  available?: (item: UploadItem) => ActionKey[]
  isSelected?: (item: UploadItem) => boolean
  label?: (item: UploadItem) => string | null
}

export interface PreviewRequest {
  items: PreviewItem[]
  index: number
  actions?: PreviewActions
  allowUse?: boolean
}

interface PreviewState {
  request: PreviewRequest | null
  version: number
  open: (request: PreviewRequest) => void
  close: () => void
  refresh: () => void
}

/**
 * Open request plus a refresh counter for live selection reads.
 * Select and deselect return true to keep the preview open for multi-select.
 * Every other action returns nothing and closes it, and no return means close.
 */
export const usePreviewStore = create<PreviewState>((set) => {
  return {
    request: null,
    version: 0,
    open: (request) => {
      set({
        request: {
          ...request,
          index: Math.min(Math.max(0, request.index), Math.max(0, request.items.length - 1)),
        },
        version: 0,
      })
    },
    close: () => {
      set({ request: null })
    },
    refresh: () => {
      set((state) => {
        return { version: state.version + 1 }
      })
    },
  }
})

/** Opens the media preview, replacing any current request. */
export function openPreview(request: PreviewRequest): void {
  usePreviewStore.getState().open(request)
}

/** Closes the media preview. */
export function closePreview(): void {
  usePreviewStore.getState().close()
}
