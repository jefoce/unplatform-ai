'use client'

import { closePreview } from '@/features/preview/preview-store'
import { useHistoryViewerStore } from '@/features/shared/history-viewer-store'

/** Closes the media preview and the history details viewer. */
export function closeViewers(): void {
  closePreview()
  useHistoryViewerStore.getState().close()
}
