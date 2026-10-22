'use client'

import { useCallback } from 'react'

import type { UploadItem } from '@/core/types'
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
  const { item, items, previewIndex, actions, selectedIndex, isAtMax, onSelect, onDelete } = props
  const stamp = new Date(item.createdAt).getTime()
  const version = Number.isNaN(stamp) ? item.id : stamp
  const isSelected = selectedIndex >= 0
  const isDisabled = !isSelected && isAtMax
  const handlePreview = useCallback(
    () => openPreview({ items, index: previewIndex, actions }),
    [actions, items, previewIndex],
  )
  const handleDelete = useCallback(() => onDelete(item), [item, onDelete])
  const handleSelect = useCallback(() => onSelect(item), [item, onSelect])
  const handlePreviewAction = item.missing === true ? undefined : handlePreview

  return (
    <MediaTile
      item={item}
      mediaRef={`uploads/${item.id}`}
      thumbVersion={version}
      selected={isSelected}
      selectIndex={isSelected ? selectedIndex : undefined}
      disabled={isDisabled}
      missing={item.missing}
      onDelete={handleDelete}
      onSelect={handleSelect}
      onPreview={handlePreviewAction}
    />
  )
}
