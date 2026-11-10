'use client'

import { cn } from '@/lib/cn'
import type { ImageGridItem } from '@/lib/feed/output-items'
import { RetryImage } from '@/ui/RetryImage'

import { cancelImageGrace } from '../actions/image-actions'
import { endpointOfflineView, imageStatusView } from '../status/status-view'
import { StatusOverlay } from '../status/StatusOverlay'
import { useImageRecordOffline } from '../status/use-record-offline'

interface ImageTileMediaProps {
  item: ImageGridItem
  thumbSrc: string
  isCompleted: boolean
  radius: string
}

/** Image tile media: saved thumb or the pending/failed placeholder. */
export function ImageTileMedia(props: ImageTileMediaProps) {
  const { item, thumbSrc, isCompleted, radius } = props
  const isOffline = useImageRecordOffline(item.source)

  const handleCancel = () => {
    void cancelImageGrace(item.recordId)
  }

  if (!isCompleted) {
    const base = imageStatusView(item, handleCancel)
    let view = base

    if (isOffline) {
      view = endpointOfflineView(base)
    }

    return <StatusOverlay view={view} fill className={radius} />
  }

  return <RetryImage src={thumbSrc} alt="" className={cn('size-full object-cover', radius)} />
}
