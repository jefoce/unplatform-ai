'use client'

import type { CSSProperties } from 'react'

import { GRID_TILE_ASPECT } from '@/core/constants'
import { cn } from '@/lib/cn'
import {
  type HistoryItem,
  imageThumbForWidth,
  isVideoItem,
  posterForWidth,
  selectionLabel,
} from '@/lib/feed/output-items'

import { SelectionCheckbox } from '../selection/SelectionCheckbox'
import { useSelectionItem } from '../selection/use-selection-item'
import { canOpenItem } from './can-open'
import { HistoryTileChrome } from './HistoryTileChrome'
import { ImageTileMedia } from './ImageTileMedia'
import { TILE_RADIUS } from './tile-radius'
import { useTileActivation } from './use-tile-activation'
import { VideoTileMedia } from './VideoTileMedia'
import { zoomToTileWidth } from './view-store'

type TileVariant = 'grid' | 'masonry'

interface HistoryTileProps {
  item: HistoryItem
  zoom: number
  onOpen: (item: HistoryItem) => void
  variant?: TileVariant
  mediaWidth: number
}

const BASE_CLASSES =
  'group/card @container relative overflow-hidden bg-surface outline-none select-none'

const SIZE_CLASSES = {
  grid: '',
  masonry: 'size-full',
} satisfies Record<TileVariant, string>

const tileCursorClass = (isCompleted: boolean, isSelecting: boolean): string => {
  if (isCompleted || isSelecting) {
    return 'cursor-pointer'
  }

  return 'cursor-default'
}

const tileLabel = (isVideo: boolean, isSelecting: boolean): string => {
  if (isSelecting) {
    return 'Toggle selection'
  }

  if (isVideo) {
    return 'Open video details'
  }

  return 'Open image details'
}

interface TilePosterParams {
  item: HistoryItem
  tileWidth: number
  devicePixelRatio: number
}

const tilePoster = (params: TilePosterParams): string => {
  const { item, tileWidth, devicePixelRatio } = params

  if (!isVideoItem(item)) {
    return imageThumbForWidth({ item, mediaWidth: tileWidth, devicePixelRatio })
  }

  return posterForWidth({ record: item.source, mediaWidth: tileWidth, devicePixelRatio }) ?? ''
}

const renderedWidth = (mediaWidth: number, zoom: number): number => {
  if (mediaWidth > 0) {
    return mediaWidth
  }

  return zoomToTileWidth(zoom)
}

const gridTileStyle = (tileWidth: number): CSSProperties => {
  return {
    aspectRatio: GRID_TILE_ASPECT,
    contentVisibility: 'auto',
    containIntrinsicSize: `auto ${tileWidth}px`,
  }
}

/** Grid tile: images use one item per output, video keeps one per record. */
export function HistoryTile(props: HistoryTileProps) {
  const { item, variant = 'grid' } = props
  const isVideo = isVideoItem(item)
  const isCompleted = item.status === 'completed'
  const isMasonry = variant === 'masonry'
  const { zoom } = props

  const radius = TILE_RADIUS[variant][item.recordKind]
  const measuredWidth = renderedWidth(props.mediaWidth, zoom)
  const devicePixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio
  const poster = tilePoster({ item, tileWidth: measuredWidth, devicePixelRatio })

  const { selected: isSelected, selecting: isSelecting, select } = useSelectionItem(item.id)
  const isDisabled = !item.canSelect && !canOpenItem(item)

  const { handleClick, handleKeyDown } = useTileActivation({
    item,
    isSelecting,
    canSelect: item.canSelect,
    isDisabled,
    select,
    onOpen: props.onOpen,
  })

  const selectLabel = tileLabel(isVideo, isSelecting)
  const cursorClass = tileCursorClass(isCompleted, isSelecting)
  const tabIndex = isDisabled ? -1 : 0

  let tileStyle: CSSProperties | undefined

  if (!isMasonry) {
    tileStyle = gridTileStyle(measuredWidth)
  }

  return (
    <div
      role="button"
      tabIndex={tabIndex}
      aria-disabled={isDisabled}
      aria-label={selectLabel}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(BASE_CLASSES, cursorClass, radius, SIZE_CLASSES[variant])}
      style={tileStyle}
    >
      {item.canSelect && <SelectionCheckbox id={item.id} label={selectionLabel(item)} />}

      {isVideo && (
        <VideoTileMedia
          item={item}
          poster={poster}
          isCompleted={isCompleted}
          isMasonry={isMasonry}
          radius={radius}
        />
      )}
      {!isVideo && (
        <ImageTileMedia item={item} thumbSrc={poster} isCompleted={isCompleted} radius={radius} />
      )}

      <HistoryTileChrome item={item} isCompleted={isCompleted} isSelecting={isSelecting} />

      {isSelected && (
        <span
          aria-hidden
          className={cn('pointer-events-none absolute inset-0 z-20 border-2 border-white', radius)}
        />
      )}
    </div>
  )
}
