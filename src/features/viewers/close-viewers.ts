'use client'

import { useHistoryViewerStore } from '@/features/history/list/history-viewer-store'
import { closePreview } from '@/features/preview/preview-store'

/** Closes the media preview and the history details viewer. */
export function closeViewers(): void {
  closePreview()
  useHistoryViewerStore.getState().close()
}
