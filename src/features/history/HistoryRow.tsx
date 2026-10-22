'use client'

import { type MouseEvent, useCallback, useRef } from 'react'

import { DETAILS_MIN_WIDTH, ROW_MIN_HEIGHT } from '@/core/constants'
import type { GenerationRecord } from '@/core/types'
import { LazyVideo } from '@/features/player/LazyVideo'
import { isOwnEvent } from '@/lib/events'

import { CardActions } from './CardActions'
import { DetailsPanel } from './DetailsPanel'
import { cancelGeneration } from './record-actions'
import { isSelectable, posterSrc, videoSrc } from './record-view'
import { SelectionCheckbox } from './SelectionCheckbox'
import { StatusOverlay } from './StatusOverlay'
import { useMediaWidth } from './use-media-width'
import { useSelectionItem } from './use-selection-item'
import { listVideoShare, useHistoryViewStore } from './view-store'

const MEDIA_ASPECT = '16 / 9'

interface HistoryRowProps {
  record: GenerationRecord
}

/** List row: 16:9 media left, details right, both scale with the row width. */
export function HistoryRow(props: HistoryRowProps) {
  const { record } = props
  const isCompleted = record.status === 'completed'
  const zoom = useHistoryViewStore((state) => state.zoom)
  const videoShare = listVideoShare(zoom)
  const mediaRef = useRef<HTMLDivElement>(null)
  const mediaWidth = useMediaWidth(mediaRef)
  const deviceDpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio
  const dpr = Math.max(deviceDpr, 1)
  const posterWidth = mediaWidth > 0 ? Math.ceil((mediaWidth * dpr) / 80) * 80 : undefined
  const poster = posterSrc(record, posterWidth)
  const { selected: isSelected, selecting: isSelecting, select } = useSelectionItem(record.id)
  const canSelect = isSelectable(record)
  const handleSelect = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!isOwnEvent(event)) return

      if ((event.target as HTMLElement).closest('button, a, input')) return

      if (event.shiftKey) {
        if (canSelect) select(true)

        return
      }

      if (isSelecting && !isSelected && canSelect) select(false)
    },
    [canSelect, isSelecting, isSelected, select],
  )
  const handleCancel = useCallback(() => void cancelGeneration(record.id), [record.id])

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
        className="relative shrink-0 cursor-default self-start overflow-hidden rounded-2xl bg-surface select-none"
        style={{
          width: `${videoShare * 100}%`,
          maxWidth: `calc(100% - ${DETAILS_MIN_WIDTH}px - 0.75rem)`,
          aspectRatio: MEDIA_ASPECT,
        }}
      >
        {isCompleted && <SelectionCheckbox id={record.id} />}

        {isCompleted ? (
          <LazyVideo
            id={record.id}
            src={videoSrc(record)}
            poster={poster}
            posterFit="cover"
            videoFit="contain"
            interactive={!isSelecting || isSelected}
            className="size-full"
          />
        ) : (
          <StatusOverlay record={record} fill onCancel={handleCancel} />
        )}

        {isSelected && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] border-2 border-white"
          />
        )}

        {isCompleted && !isSelecting && <CardActions record={record} className="top-3" pinHeart />}
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
