import type { ImageGridItem, VideoGridItem } from '@/lib/feed/output-items'

import { deleteImageItem, reuseImagePrompt, revealImageItem, saveImageItem } from './image-actions'
import type { MenuActions } from './menu-entries'
import { deleteRecord, rerunRecord } from './record-actions'
import {
  addReference,
  captureFrame,
  copyPrompt,
  copySeed,
  revealRecord,
} from './record-menu-actions'

interface MenuItem {
  video: VideoGridItem | null
  image: ImageGridItem | null
}

export async function deleteMenuItem(item: MenuItem): Promise<void> {
  const { video, image } = item

  if (video) {
    await deleteRecord(video.source)

    return
  }

  if (image) {
    await deleteImageItem(image)
  }
}

interface MoreMenuActionsParams extends MenuItem {
  onRegenerate: () => void
  onRemove: () => void
}

/** Handlers shared by the image and video menu entries. */
export function useMoreMenuActions(params: MoreMenuActionsParams): MenuActions {
  const { video, image, onRegenerate, onRemove } = params

  const handleReveal = () => {
    if (video) {
      void revealRecord(video.source)

      return
    }

    if (image) {
      void revealImageItem(image)
    }
  }

  const handleDownload = () => {
    if (image) {
      void saveImageItem(image)
    }
  }

  const handleReuse = () => {
    if (video) {
      void rerunRecord(video.source)

      return
    }

    if (image) {
      void reuseImagePrompt(image)
    }
  }

  const handleCaptureLast = () => {
    if (video) {
      void captureFrame(video.source, 'last')
    }
  }

  const handleCaptureFirst = () => {
    if (video) {
      void captureFrame(video.source, 'first')
    }
  }

  const handleAddReference = () => {
    if (video) {
      void addReference(video.source)
    }
  }

  const handleCopyPrompt = () => {
    if (video) {
      void copyPrompt(video.source)
    }
  }

  const handleCopySeed = () => {
    if (video) {
      void copySeed(video.source)
    }
  }

  return {
    onRegenerate,
    onReveal: handleReveal,
    onDownload: handleDownload,
    onReuse: handleReuse,
    onRemove,
    onCaptureLast: handleCaptureLast,
    onCaptureFirst: handleCaptureFirst,
    onAddReference: handleAddReference,
    onCopyPrompt: handleCopyPrompt,
    onCopySeed: handleCopySeed,
  }
}
