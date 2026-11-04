'use client'

import { cn } from '@/lib/cn'
import type { ImageGridItem } from '@/lib/feed/output-items'
import { RetryImage } from '@/ui/RetryImage'

import { cancelImageGrace } from '../actions/image-actions'
import { imageStatusView } from '../status/status-view'
import { StatusOverlay } from '../status/StatusOverlay'

interface ImageTileMediaProps {
  item: ImageGridItem
  thumbSrc: string
  isCompleted: boolean
  radius: string
}

/** Image tile media: saved thumb or the pending/failed placeholder. */
export function ImageTileMedia(props: ImageTileMediaProps) {
  const { item, thumbSrc, isCompleted, radius } = props

  const handleCancel = () => {
    void cancelImageGrace(item.recordId)
  }

  if (!isCompleted) {
    return <StatusOverlay view={imageStatusView(item, handleCancel)} fill className={radius} />
  }

  return <RetryImage src={thumbSrc} alt="" className={cn('size-full object-cover', radius)} />
}
