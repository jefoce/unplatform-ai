'use client'

import { useCallback, useState } from 'react'

import type { UploadItem } from '@/core/types'
import { cn } from '@/lib/cn'

import { mediaUrl, thumbUrl } from './api'
import { MediaTileAudio } from './MediaTileAudio'
import { MediaTileBadges } from './MediaTileBadges'
import { MediaTileControls } from './MediaTileControls'
import { MediaTilePreview } from './MediaTilePreview'
import { SELECTED_TILE_CLASSES } from './tile-classes'

export interface MediaTileProps {
  item: UploadItem
  mediaRef: string
  selected?: boolean
  selectIndex?: number
  disabled?: boolean
  missing?: boolean
  thumbVersion?: string | number
  onDelete?: () => void
  onSelect: () => void
  onPreview?: () => void
}

/** Square media tile with selection, source and missing states. */
export function MediaTile(props: MediaTileProps) {
  const {
    item,
    mediaRef,
    selected: isSelected,
    selectIndex,
    disabled: isDisabled,
    missing: isMissing,
    thumbVersion,
    onDelete,
    onSelect,
    onPreview,
  } = props
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null)
  const isBlocked = isMissing === true || isDisabled === true
  const isAudio = item.kind === 'audio'
  const isPreviewable = item.kind === 'image' || item.kind === 'video'
  const thumbSrc = thumbUrl({ ref: mediaRef, w: undefined, version: thumbVersion })
  const isBroken = brokenSrc === thumbSrc
  const mediaSrc = mediaUrl(mediaRef, item.mime)
  const handleThumbError = useCallback(() => setBrokenSrc(thumbSrc), [thumbSrc])
  const handleSelect = onSelect
  const handlePreview = onPreview
  const handleDelete = onDelete

  return (
    <div
      className={cn(
        'group relative aspect-square overflow-hidden rounded-lg border border-line bg-surface',
        isMissing === true && 'bg-danger/10',
        isDisabled === true && 'opacity-40',
        isSelected === true && SELECTED_TILE_CLASSES,
      )}
    >
      <MediaTilePreview
        kind={item.kind}
        isBroken={isBroken}
        thumbSrc={thumbSrc}
        durationSec={item.durationSec}
        onThumbError={handleThumbError}
      />

      {isAudio && <MediaTileAudio item={item} audioSrc={mediaSrc} isMissing={isMissing === true} />}

      <MediaTileControls
        label={item.originalName}
        isPreviewable={isPreviewable}
        isBlocked={isBlocked}
        isSelected={isSelected === true}
        isMissing={isMissing === true}
        onSelect={handleSelect}
        onPreview={handlePreview}
        onDelete={handleDelete}
      />

      <MediaTileBadges
        isMissing={isMissing === true}
        isLink={item.source === 'link'}
        isSelected={isSelected === true}
        selectIndex={selectIndex}
      />
    </div>
  )
}
