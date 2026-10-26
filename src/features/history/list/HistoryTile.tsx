'use client'

import { GRID_TILE_ASPECT } from '@/core/constants'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import { LazyVideo } from '@/features/player/LazyVideo'

import { CardActions } from '../actions/CardActions'
import { FavoriteBadge } from '../actions/FavoriteBadge'
import { cancelGeneration } from '../actions/record-actions'
import { isSelectable, posterSrc, videoSrc } from '../actions/record-view'
import { SelectionCheckbox } from '../selection/SelectionCheckbox'
import { useSelectionItem } from '../selection/use-selection-item'
import { StatusOverlay } from '../status/StatusOverlay'
import { CardVignette } from './CardVignette'
import { useTileActivation } from './use-tile-activation'
import { useHistoryViewStore, zoomToGridColumns, zoomToTileWidth } from './view-store'

interface HistoryTileProps {
  record: GenerationRecord
  onOpen: (record: GenerationRecord) => void
}

/** Grid tile: hover plays a muted loop, actions replace the liked badge. */
export function HistoryTile(props: HistoryTileProps) {
  const { record } = props
  const isCompleted = record.status === 'completed'

  const zoom = useHistoryViewStore((state) => {
    return state.zoom
  })

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
    onOpen: props.onOpen,
  })

  const handleCancel = () => {
    return void cancelGeneration(record.id)
  }

  const selectLabel = isSelecting ? 'Toggle selection' : 'Open video details'

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={selectLabel}
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

      {isCompleted && (
        <LazyVideo
          id={record.id}
          src={videoSrc(record)}
          poster={poster}
          posterFit="cover"
          videoFit="cover"
          hoverPlay
          className="size-full"
        />
      )}
      {!isCompleted && (
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
          <CardVignette scope="card" />
          {record.favorite && <FavoriteBadge record={record} />}
          <CardActions record={record} className="top-3 z-20" />
        </>
      )}
    </div>
  )
}
