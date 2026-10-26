'use client'

import { create } from 'zustand'

import type { UploadItem } from '@/core/schemas/upload-item'

/** Upload item plus a read-only ref for files not linked yet. */
export interface PreviewItem extends UploadItem {
  previewRef?: string
}

export type ActionKey = keyof Omit<PreviewActions, 'available' | 'label'>

export interface PreviewActions {
  insert?: (item: UploadItem) => void
  replace?: (item: UploadItem) => void
  remove?: (item: UploadItem) => void
  select?: (item: UploadItem) => void
  deselect?: (item: UploadItem) => void
  useAsStart?: (item: UploadItem) => void
  addAsReference?: (item: UploadItem) => void
  available?: (item: UploadItem) => ActionKey[]
  label?: (item: UploadItem) => string | null
}

export interface PreviewRequest {
  items: PreviewItem[]
  index: number
  actions?: PreviewActions
}

interface PreviewState {
  request: PreviewRequest | null
  open: (request: PreviewRequest) => void
  close: () => void
}

export const usePreviewStore = create<PreviewState>((set) => {
  return {
    request: null,
    open: (request) => {
      set({
        request: {
          ...request,
          index: Math.min(Math.max(0, request.index), Math.max(0, request.items.length - 1)),
        },
      })
    },
    close: () => {
      set({ request: null })
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
