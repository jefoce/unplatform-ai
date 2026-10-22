'use client'

import { useCallback } from 'react'
import { isNil } from 'lodash-es'

import { type RefSlot, slotLabel } from '@/core/prompt-tokens'
import type { UploadItem } from '@/core/types'
import { openMediaPicker, type PickerExtensions } from '@/features/media-picker/store'
import { openPreview } from '@/features/preview/preview-store'

import { ReferenceThumb } from './ReferenceThumb'
import { SortableReference } from './SortableReference'

interface ReferenceItemProps {
  id: string
  upload?: UploadItem
  label?: string
  note?: string
  isLifted?: boolean
  previewUploads: UploadItem[]
  slots: Map<string, RefSlot>
  extensions?: PickerExtensions
  onSelectSlot: (slot: RefSlot) => void
  onReplace: (id: string, upload: UploadItem) => void
  onRemove: (id: string) => void
}

/** One reference cell with preview, replace and remove handlers. */
export function ReferenceItem(props: ReferenceItemProps) {
  const {
    id,
    upload,
    label,
    note,
    isLifted,
    previewUploads,
    slots,
    extensions,
    onSelectSlot,
    onReplace,
    onRemove,
  } = props
  const handleInsert = (item: UploadItem): void => {
    const slot = slots.get(item.id)

    if (slot) onSelectSlot(slot)
  }
  const handleReplace = (item: UploadItem): void => {
    const handleReplacePick = (items: UploadItem[]): void => {
      const [next] = items

      if (!isNil(next)) onReplace(item.id, next)
    }

    openMediaPicker({
      target: 'references',
      kinds: [item.kind],
      max: 1,
      extensions,
      onPick: handleReplacePick,
    })
  }
  const handleRemoveAction = (item: UploadItem): void => onRemove(item.id)
  const handleLabel = (item: UploadItem): string | null => {
    const slot = slots.get(item.id)

    return slot ? slotLabel(slot) : null
  }
  const handleRemove = useCallback((): void => onRemove(id), [id, onRemove])
  const handlePreview = (): void => {
    const index = previewUploads.findIndex((item) => item.id === id)

    openPreview({
      items: previewUploads,
      index,
      actions: {
        insert: handleInsert,
        replace: handleReplace,
        remove: handleRemoveAction,
        label: handleLabel,
      },
    })
  }
  const canPreview = !isNil(upload) && upload.kind !== 'audio'
  const handleOpenPreview = canPreview ? handlePreview : undefined

  if (isLifted === true) {
    return (
      <ReferenceThumb
        upload={upload}
        label={label}
        note={note}
        onOpenPreview={handleOpenPreview}
        onRemove={handleRemove}
        lifted
      />
    )
  }

  return (
    <SortableReference
      id={id}
      upload={upload}
      label={label}
      note={note}
      onOpenPreview={handleOpenPreview}
      onRemove={handleRemove}
    />
  )
}
