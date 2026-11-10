'use client'

import { isNil } from 'lodash-es'

import { isOneOf } from '@/core/guards'
import { TERMINAL_STATUSES } from '@/core/types'
import { type HistoryItem, isVideoItem } from '@/lib/feed/output-items'

import type { CardAction } from '../actions/card-action'
import { HOVER_REVEAL_CLASSES } from '../actions/card-action-styles'
import { fitCompactActions } from '../actions/card-actions-fit'
import { CardActions } from '../actions/CardActions'
import { FavoriteBadge } from '../actions/FavoriteBadge'
import { favoriteImageItem } from '../actions/image-actions'
import { imageCardActions } from '../actions/image-card-actions'
import { MoreMenu } from '../actions/MoreMenu'
import { toggleFavoriteId } from '../actions/record-actions'
import { videoCardActions } from '../actions/video-card-actions'
import { CardVignette } from './CardVignette'

const isTerminal = (item: HistoryItem, isCompleted: boolean): boolean => {
  if (isCompleted) {
    return true
  }

  if (isVideoItem(item)) {
    return isOneOf(TERMINAL_STATUSES, item.status)
  }

  return item.status !== 'submitting' && item.status !== 'saving'
}

function actionList(item: HistoryItem, isTerminalItem: boolean): CardAction[] {
  if (isTerminalItem) {
    return tileActions(item)
  }

  return []
}

function tileActions(item: HistoryItem) {
  if (isVideoItem(item)) {
    return videoCardActions(item)
  }

  return imageCardActions(item)
}

interface HistoryTileChromeProps {
  item: HistoryItem
  isCompleted: boolean
  isSelecting: boolean
  isCompact: boolean
  tileHeight?: number
}

/** Vignette, favorite badge and hover actions shared by image and video tiles. */
export function HistoryTileChrome(props: HistoryTileChromeProps) {
  const { item, isCompleted, isSelecting, isCompact, tileHeight } = props

  if (isSelecting) {
    return null
  }

  const isTerminalItem = isTerminal(item, isCompleted)
  const actions = actionList(item, isTerminalItem)
  let shownActions = actions

  if (isCompact && !isNil(tileHeight)) {
    shownActions = fitCompactActions({ actions, height: tileHeight })
  }

  const handleFavorite = () => {
    if (isVideoItem(item)) {
      void toggleFavoriteId(item.id, item.favorite)

      return
    }

    void favoriteImageItem(item)
  }

  return (
    <>
      {isCompleted && <CardVignette scope="card" />}
      {isCompleted && item.favorite && (
        <FavoriteBadge isFavorite onToggle={handleFavorite} isCompact={isCompact} />
      )}
      {isTerminalItem && (
        <CardActions
          actions={shownActions}
          menu={<MoreMenu item={item} className={HOVER_REVEAL_CLASSES} isCompact={isCompact} />}
          className="top-3 z-20"
          isCompact={isCompact}
        />
      )}
    </>
  )
}
