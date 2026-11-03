import { Download, Heart, ImagePlus, RefreshCw, Trash2 } from 'lucide-react'

import type { ImageGridItem } from '@/lib/feed/output-items'

import type { CardAction } from './card-action'
import {
  deleteImageItem,
  favoriteImageItem,
  referenceImageItem,
  saveImageItem,
} from './image-actions'
import { regenerateItem } from './regenerate-actions'
import { imageRegenerateDescription } from './regenerate-confirm'

/** Heart and reference for a saved image, regenerate for a failed output. */
export function imageCardActions(item: ImageGridItem): CardAction[] {
  const isSaved = item.output?.status === 'saved'

  if (!isSaved) {
    return [
      {
        key: 'regenerate',
        label: 'Regenerate',
        icon: RefreshCw,
        confirm: {
          label: 'Regenerate image',
          title: 'Regenerate?',
          description: imageRegenerateDescription(item),
          confirmLabel: 'Regenerate',
          isDanger: false,
          successMessage: null,
          onConfirm: () => {
            return regenerateItem(item)
          },
        },
      },
      {
        key: 'delete',
        label: 'Delete',
        icon: Trash2,
        confirm: {
          label: 'Delete image',
          title: 'Delete image?',
          description: 'Delete this image? The file is removed from your computer.',
          onConfirm: () => {
            return deleteImageItem(item)
          },
        },
      },
    ]
  }

  const favoriteLabel = item.favorite ? 'Liked' : 'Like'

  return [
    {
      key: 'favorite',
      label: favoriteLabel,
      icon: Heart,
      onSelect: () => {
        void favoriteImageItem(item)
      },
      isActive: item.favorite,
    },
    {
      key: 'download',
      label: 'Download',
      icon: Download,
      onSelect: () => {
        void saveImageItem(item)
      },
    },
    {
      key: 'reference',
      label: 'Reference',
      icon: ImagePlus,
      onSelect: () => {
        void referenceImageItem(item)
      },
    },
  ]
}
