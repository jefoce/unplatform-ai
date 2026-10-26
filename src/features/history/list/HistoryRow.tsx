'use client'

import { type MouseEvent, useRef } from 'react'

import { DETAILS_MIN_WIDTH, ROW_MIN_HEIGHT } from '@/core/constants'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import { LazyVideo } from '@/features/player/LazyVideo'
import { isOwnEvent } from '@/lib/events'

import { CardActions } from '../actions/CardActions'
import { cancelGeneration } from '../actions/record-actions'
import { isSelectable, posterForWidth, videoSrc } from '../actions/record-view'
import { DetailsPanel } from '../details/DetailsPanel'
import { SelectionCheckbox } from '../selection/SelectionCheckbox'
import { useSelectionItem } from '../selection/use-selection-item'
import { StatusOverlay } from '../status/StatusOverlay'
import { CardVignette } from './CardVignette'
import { useMediaWidth } from './use-media-width'
import { listVideoShare, useHistoryViewStore } from './view-store'

const MEDIA_ASPECT = '16 / 9'

interface HistoryRowProps {
  record: GenerationRecord
}

/** List row: 16:9 media left, details right, both scale with the row width. */
export function HistoryRow(props: HistoryRowProps) {
  const { record } = props
  const isCompleted = record.status === 'completed'

  const zoom = useHistoryViewStore((state) => {
    return state.zoom
  })

  const videoShare = listVideoShare(zoom)
  const mediaRef = useRef<HTMLDivElement>(null)
  const mediaWidth = useMediaWidth(mediaRef)
  const poster = posterForWidth(record, mediaWidth)
  const { selected: isSelected, selecting: isSelecting, select } = useSelectionItem(record.id)
  const canSelect = isSelectable(record)
  const shouldShowCard = isCompleted && !isSelecting

  const handleSelect = (event: MouseEvent<HTMLDivElement>) => {
    const isRowClick =
      isOwnEvent(event) && !(event.target as HTMLElement).closest('button, a, input')

    if (!isRowClick) {
      return
    }

    if (event.shiftKey && canSelect) {
      select(true)

      return
    }

    if (isSelecting && !isSelected && canSelect) {
      select(false)
    }
  }

  const handleCancel = () => {
    return void cancelGeneration(record.id)
  }

  return (
    <div
      className="group/card flex w-full items-stretch gap-3"
      style={{
        minHeight: ROW_MIN_HEIGHT,
        contentVisibility: 'auto',
        containIntrinsicSize: `auto ${ROW_MIN_HEIGHT}px`,
      }}
    >
      <div
        ref={mediaRef}
        onClick={handleSelect}
        className="group/media relative shrink-0 cursor-default self-start overflow-hidden rounded-2xl bg-surface select-none"
        style={{
          width: `${videoShare * 100}%`,
          maxWidth: `calc(100% - ${DETAILS_MIN_WIDTH}px - 0.75rem)`,
          aspectRatio: MEDIA_ASPECT,
        }}
      >
        {isCompleted && <SelectionCheckbox id={record.id} />}

        {isCompleted && (
          <LazyVideo
            id={record.id}
            src={videoSrc(record)}
            poster={poster}
            posterFit="cover"
            videoFit="contain"
            interactive={!isSelecting || isSelected}
            className="size-full"
          />
        )}
        {shouldShowCard && <CardVignette scope="media" />}
        {!isCompleted && <StatusOverlay record={record} fill onCancel={handleCancel} />}

        {isSelected && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] border-2 border-white"
          />
        )}

        {shouldShowCard && <CardActions record={record} className="top-3 z-20" pinHeart />}
      </div>

      <div
        className="min-h-0 flex-1 self-stretch overflow-hidden"
        style={{ minWidth: DETAILS_MIN_WIDTH }}
      >
        <DetailsPanel record={record} />
      </div>
    </div>
  )
}
