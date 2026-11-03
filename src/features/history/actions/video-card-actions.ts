import { Download, Heart, RefreshCw } from 'lucide-react'

import type { VideoGridItem } from '@/lib/feed/output-items'

import type { CardAction } from './card-action'
import { saveRecordVideo, toggleFavoriteId } from './record-actions'
import { regenerateItem } from './regenerate-actions'
import { videoRegenerateDescription } from './regenerate-confirm'

/** Heart and download for a completed video, regenerate for a failed record. */
export function videoCardActions(item: VideoGridItem, isPinHeart = false): CardAction[] {
  if (item.status !== 'completed') {
    return [
      {
        key: 'regenerate',
        label: 'Regenerate',
        icon: RefreshCw,
        confirm: {
          label: 'Regenerate video',
          title: 'Regenerate?',
          description: videoRegenerateDescription(item.source),
          confirmLabel: 'Regenerate',
          isDanger: false,
          successMessage: null,
          onConfirm: () => {
            return regenerateItem(item)
          },
        },
      },
    ]
  }

  const handleFavorite = () => {
    void toggleFavoriteId(item.id, item.favorite)
  }

  const handleDownload = () => {
    void saveRecordVideo(item.source)
  }

  const favoriteLabel = item.favorite ? 'Liked' : 'Like'

  return [
    {
      key: 'favorite',
      label: favoriteLabel,
      icon: Heart,
      onSelect: handleFavorite,
      isActive: item.favorite,
      isPinned: isPinHeart && item.favorite,
    },
    {
      key: 'download',
      label: 'Download',
      icon: Download,
      onSelect: handleDownload,
    },
  ]
}
