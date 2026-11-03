'use client'

import type { VideoGridItem } from '@/lib/feed/output-items'

import { HOVER_REVEAL_CLASSES } from '../actions/card-action-styles'
import { CardActions } from '../actions/CardActions'
import { MoreMenu } from '../actions/MoreMenu'
import { videoCardActions } from '../actions/video-card-actions'

interface HistoryRowActionsProps {
  item: VideoGridItem
}

/** Pinned heart, download and record menu for one list row. */
export function HistoryRowActions(props: HistoryRowActionsProps) {
  const { item } = props

  return (
    <CardActions
      actions={videoCardActions(item, true)}
      menu={<MoreMenu item={item} className={HOVER_REVEAL_CLASSES} />}
      className="top-3 z-20"
    />
  )
}
