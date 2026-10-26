'use client'

import type { UploadItem } from '@/core/schemas/upload-item'
import { openPreview, type PreviewActions } from '@/features/preview/preview-store'

import { MediaTile } from './MediaTile'

interface MediaRowProps {
  item: UploadItem
  items: UploadItem[]
  previewIndex: number
  actions: PreviewActions
  selectedIndex: number
  isAtMax: boolean
  onSelect: (item: UploadItem) => void
  onDelete: (item: UploadItem) => void
}

/** Upload grid row bridging selection state to the media tile. */
export function MediaRow(props: MediaRowProps) {
  const { item, items, previewIndex, actions, selectedIndex, isAtMax } = props
  const stamp = new Date(item.createdAt).getTime()
  const isVersion = Number.isNaN(stamp)

  const version = isVersion ? item.id : stamp
  const isSelected = selectedIndex >= 0
  const isDisabled = !isSelected && isAtMax

  const handlePreview = () => {
    openPreview({ items, index: previewIndex, actions })
  }

  const handleDelete = () => {
    props.onDelete(item)
  }

  const handleSelect = () => {
    props.onSelect(item)
  }

  const handlePreviewAction = item.missing === true ? undefined : handlePreview
  const selectIndex = isSelected ? selectedIndex : undefined

  return (
    <MediaTile
      item={item}
      mediaRef={`uploads/${item.id}`}
      thumbVersion={version}
      selected={isSelected}
      selectIndex={selectIndex}
      disabled={isDisabled}
      missing={item.missing}
      onDelete={handleDelete}
      onSelect={handleSelect}
      onPreview={handlePreviewAction}
    />
  )
}
