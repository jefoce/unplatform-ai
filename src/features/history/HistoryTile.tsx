'use client'

import { useCallback } from 'react'

import { GRID_TILE_ASPECT } from '@/core/constants'
import type { GenerationRecord } from '@/core/types'
import { LazyVideo } from '@/features/player/LazyVideo'

import { CardActions } from './CardActions'
import { FavoriteBadge } from './FavoriteBadge'
import { cancelGeneration } from './record-actions'
import { isSelectable, posterSrc, videoSrc } from './record-view'
import { SelectionCheckbox } from './SelectionCheckbox'
import { StatusOverlay } from './StatusOverlay'
import { useSelectionItem } from './use-selection-item'
import { useTileActivation } from './use-tile-activation'
import { useHistoryViewStore, zoomToGridColumns, zoomToTileWidth } from './view-store'

interface HistoryTileProps {
  record: GenerationRecord
  onOpen: (record: GenerationRecord) => void
}

/** Grid tile: hover plays a muted loop, actions replace the liked badge. */
export function HistoryTile(props: HistoryTileProps) {
  const { record, onOpen } = props
  const isCompleted = record.status === 'completed'
  const zoom = useHistoryViewStore((state) => state.zoom)
  const tileWidth = zoomToTileWidth(zoom)
  const isCompact = zoomToGridColumns(zoom) >= 7 // dense rows shrink the status pill
  const deviceDpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio
  const dpr = Math.max(deviceDpr, 1)
  const poster = posterSrc(record, Math.ceil((tileWidth * dpr) / 80) * 80)
  const { selected: isSelected, selecting: isSelecting, select } = useSelectionItem(record.id)
  const canSelect = isSelectable(record)
  const { handleClick, handleKeyDown } = useTileActivation({
    record,
    isSelecting,
    canSelect,
    select,
    onOpen,
  })
  const handleCancel = useCallback(() => void cancelGeneration(record.id), [record.id])

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={isSelecting ? 'Toggle selection' : 'Open video details'}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="group/card relative cursor-pointer overflow-hidden rounded-2xl bg-surface outline-none select-none"
      style={{
        aspectRatio: GRID_TILE_ASPECT,
        contentVisibility: 'auto',
        containIntrinsicSize: `auto ${tileWidth}px`,
      }}
    >
      {isCompleted && <SelectionCheckbox id={record.id} />}

      {isCompleted ? (
        <LazyVideo
          id={record.id}
          src={videoSrc(record)}
          poster={poster}
          posterFit="cover"
          videoFit="cover"
          hoverPlay
          className="size-full"
        />
      ) : (
        <div className="size-full">
          <StatusOverlay
            record={record}
            boxAspect={GRID_TILE_ASPECT}
            compact={isCompact}
            onCancel={handleCancel}
          />
        </div>
      )}

      {isSelected && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] border-2 border-white"
        />
      )}

      {isCompleted && !isSelecting && (
        <>
          <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.55)_100%)] opacity-0 transition-opacity duration-300 ease-out group-hover/card:opacity-100 group-has-focus-visible/card:opacity-100" />
          {record.favorite && <FavoriteBadge record={record} />}
          <CardActions record={record} className="top-3 z-20" />
        </>
      )}
    </div>
  )
}
