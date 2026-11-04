'use client'

import { useId } from 'react'
import { isNil } from 'lodash-es'

import type { UploadItem } from '@/core/schemas/upload-item'
import { mediaUrl, thumbUrl } from '@/lib/api/media-urls'
import { cn } from '@/lib/cn'
import { Tooltip } from '@/ui/Tooltip'

import { MediaTileAudio } from './MediaTileAudio'
import { MediaTileBadges } from './MediaTileBadges'
import { MediaTileControls } from './MediaTileControls'
import { MediaTilePreview } from './MediaTilePreview'
import { PICKER_TILE_CLASSES, SELECTED_TILE_CLASSES } from './tile-classes'

export interface MediaTileProps {
  item: UploadItem
  mediaRef: string
  selected?: boolean
  slotNumber?: number
  disabled?: boolean
  disabledReason?: string
  missing?: boolean
  onDelete?: () => void
  onSelect: () => void
  onPreview?: () => void
}

function reasonElement(text: string | undefined, reasonId: string) {
  if (isNil(text)) {
    return null
  }

  return (
    <span id={reasonId} className="sr-only">
      {text}
    </span>
  )
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
  } = props

  const isBlocked = isMissing === true || isDisabled === true
  const tooltip = isDisabled === true ? disabledReason : undefined
  const reasonId = useId()
  const hasReason = isDisabled === true && !isNil(disabledReason)
  const describedById = hasReason ? reasonId : undefined
  const isAudio = item.kind === 'audio'
  const isPreviewable = item.kind === 'image' || item.kind === 'video'
  const thumbSrc = thumbUrl({ ref: mediaRef })
  const mediaSrc = mediaUrl(mediaRef, item.mime)

  return (
    <Tooltip content={tooltip}>
      <div
        className={cn(
          PICKER_TILE_CLASSES,
          isMissing === true && 'bg-danger/10',
          isDisabled === true && 'opacity-40',
          isSelected === true && SELECTED_TILE_CLASSES,
        )}
      >
        <MediaTilePreview kind={item.kind} thumbSrc={thumbSrc} durationSec={item.durationSec} />

        {isAudio && (
          <MediaTileAudio item={item} audioSrc={mediaSrc} isMissing={isMissing === true} />
        )}

        <MediaTileControls
          label={item.originalName}
          isPreviewable={isPreviewable}
          isBlocked={isBlocked}
          isSelected={isSelected === true}
          isMissing={isMissing === true}
          describedById={describedById}
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

        {reasonElement(disabledReason, reasonId)}
      </div>
    </Tooltip>
  )
}
