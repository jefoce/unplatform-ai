'use client'

import { type MouseEvent, useRef } from 'react'

import { DETAILS_MIN_WIDTH } from '@/core/constants'
import { LazyVideo } from '@/features/player/LazyVideo'
import { cn } from '@/lib/cn'
import { posterForWidth, selectionLabel, type VideoGridItem } from '@/lib/feed/output-items'
import { useMediaWidth } from '@/lib/use-media-width'

import { SelectionCheckbox } from '../selection/SelectionCheckbox'
import { CardVignette } from './CardVignette'
import { HistoryRowActions } from './HistoryRowActions'
import { HistoryRowStatus } from './HistoryRowStatus'
import { TILE_RADIUS } from './tile-radius'
import { listVideoShare, useHistoryViewStore } from './view-store'

const MEDIA_ASPECT = '16 / 9'

interface HistoryRowMediaProps {
  item: VideoGridItem
  isCompleted: boolean
  isSelected: boolean
  isSelecting: boolean
  onSelect: (event: MouseEvent<HTMLDivElement>) => void
}

/** 16:9 media box left of the list row details. */
export function HistoryRowMedia(props: HistoryRowMediaProps) {
  const { item, isCompleted, isSelected, isSelecting } = props
  const record = item.source

  const zoom = useHistoryViewStore((state) => {
    return state.zoom
  })

  const videoShare = listVideoShare(zoom)
  const mediaRef = useRef<HTMLDivElement>(null)
  const mediaWidth = useMediaWidth(mediaRef)
  const devicePixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio
  const poster = posterForWidth({ record, mediaWidth, devicePixelRatio })
  const shouldShowCard = isCompleted && !isSelecting

  return (
    <div
      ref={mediaRef}
      onClick={props.onSelect}
      className={cn(
        'group/media @container relative shrink-0 cursor-default self-start overflow-hidden bg-surface select-none',
        TILE_RADIUS.list.video,
      )}
      style={{
        width: `${videoShare * 100}%`,
        maxWidth: `calc(100% - ${DETAILS_MIN_WIDTH}px - 0.75rem)`,
        aspectRatio: MEDIA_ASPECT,
      }}
    >
      {item.canSelect && <SelectionCheckbox id={item.id} label={selectionLabel(item)} />}

      {isCompleted && (
        <LazyVideo
          id={item.id}
          src={item.mediaSrc}
          poster={poster}
          posterFit="cover"
          videoFit="contain"
          interactive={!isSelecting}
          className="size-full"
        />
      )}
      {shouldShowCard && <CardVignette scope="media" />}
      {!isCompleted && <HistoryRowStatus record={record} />}

      {isSelected && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 z-20 border-2 border-white',
            TILE_RADIUS.list.video,
          )}
        />
      )}

      {shouldShowCard && <HistoryRowActions item={item} />}
    </div>
  )
}
