'use client'

import { useState } from 'react'

import type { UploadItem } from '@/core/schemas/upload-item'
import { mediaUrl, thumbUrl } from '@/lib/api/media-urls'
import { cn } from '@/lib/cn'
import { Tooltip } from '@/ui/Tooltip'

import { MediaTileAudio } from './MediaTileAudio'
import { MediaTileBadges } from './MediaTileBadges'
import { MediaTileControls } from './MediaTileControls'
import { MediaTilePreview } from './MediaTilePreview'
import { SELECTED_TILE_CLASSES } from './tile-classes'

export interface MediaTileProps {
  item: UploadItem
  mediaRef: string
  selected?: boolean
  slotNumber?: number
  disabled?: boolean
  disabledReason?: string
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
    slotNumber,
    disabled: isDisabled,
    disabledReason,
    missing: isMissing,
    thumbVersion,
  } = props

  const [brokenSrc, setBrokenSrc] = useState<string | null>(null)
  const isBlocked = isMissing === true || isDisabled === true
  const tooltip = isDisabled === true ? disabledReason : undefined
  const isAudio = item.kind === 'audio'
  const isPreviewable = item.kind === 'image' || item.kind === 'video'
  const thumbSrc = thumbUrl({ ref: mediaRef, w: undefined, version: thumbVersion })
  const isBroken = brokenSrc === thumbSrc
  const mediaSrc = mediaUrl(mediaRef, item.mime)

  const handleThumbError = () => {
    setBrokenSrc(thumbSrc)
  }

  return (
    <Tooltip content={tooltip}>
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

        {isAudio && (
          <MediaTileAudio item={item} audioSrc={mediaSrc} isMissing={isMissing === true} />
        )}

        <MediaTileControls
          label={item.originalName}
          isPreviewable={isPreviewable}
          isBlocked={isBlocked}
          isSelected={isSelected === true}
          isMissing={isMissing === true}
          onSelect={props.onSelect}
          onPreview={props.onPreview}
          onDelete={props.onDelete}
        />

        <MediaTileBadges
          isMissing={isMissing === true}
          isLink={item.source === 'link'}
          isSelected={isSelected === true}
          slotNumber={slotNumber}
        />
      </div>
    </Tooltip>
  )
}
