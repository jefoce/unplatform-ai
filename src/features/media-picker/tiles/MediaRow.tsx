'use client'

import { isNil } from 'lodash-es'

import type { UploadItem } from '@/core/schemas/upload-item'
import { openPreview, type PreviewActions } from '@/features/preview/preview-store'

import { MediaTile } from './MediaTile'

interface MediaRowProps {
  item: UploadItem
  items: UploadItem[]
  previewIndex: number
  actions: PreviewActions
  slotNumber?: number
  isSelected: boolean
  disabledReason?: string
  onSelect: (item: UploadItem) => void
  onDelete: (item: UploadItem) => void
}

/** Upload grid row bridging selection state to the media tile. */
export function MediaRow(props: MediaRowProps) {
  const { item, items, previewIndex, actions, slotNumber, isSelected, disabledReason } = props
  const isDisabled = !isSelected && !isNil(disabledReason)

  const handlePreview = () => {
    openPreview({ items, index: previewIndex, actions, allowUse: false })
  }

  const handleDelete = () => {
    props.onDelete(item)
  }

  const handleSelect = () => {
    props.onSelect(item)
  }

  const handlePreviewAction = item.missing === true ? undefined : handlePreview

  return (
    <MediaTile
      item={item}
      mediaRef={`uploads/${item.id}`}
      selected={isSelected}
      slotNumber={slotNumber}
      disabled={isDisabled}
      disabledReason={disabledReason}
      missing={item.missing}
      onDelete={handleDelete}
      onSelect={handleSelect}
      onPreview={handlePreviewAction}
    />
  )
}
