'use client'

import { isNil } from 'lodash-es'

import type { KindExtensions } from '@/core/media-kinds'
import { type RefSlot, slotLabel } from '@/core/prompt-tokens'
import type { UploadItem } from '@/core/schemas/upload-item'
import { pickerAnchor } from '@/features/media-picker/picker/anchors'
import { openMediaPicker } from '@/features/media-picker/picker/store'
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
  extensions?: KindExtensions
  onSelectSlot: (slot: RefSlot) => void
  onReplace: (id: string, upload: UploadItem) => void
  onRemove: (id: string) => void
}

/** Slot label for a reference id, or null when the id has no slot. */
function referenceLabel(slots: Map<string, RefSlot>, item: UploadItem): string | null {
  const slot = slots.get(item.id)

  if (!slot) {
    return null
  }

  return slotLabel(slot)
}

/** One reference cell with preview, replace and remove handlers. */
export function ReferenceItem(props: ReferenceItemProps) {
  const { id, upload, label, note, isLifted, previewUploads, slots, extensions } = props

  const handleInsert = (item: UploadItem): void => {
    const slot = slots.get(item.id)

    if (slot) {
      props.onSelectSlot(slot)
    }
  }

  const handleReplace = (item: UploadItem): void => {
    const handleReplacePick = (next: UploadItem): void => {
      props.onReplace(item.id, next)
    }

    openMediaPicker({
      openerKey: `references:replace:${id}`,
      kinds: [item.kind],
      extensions,
      anchor: pickerAnchor('references'),
      mode: { kind: 'pick', onPick: handleReplacePick },
    })
  }

  const handleRemoveAction = (item: UploadItem): void => {
    props.onRemove(item.id)
  }

  const handleLabel = (item: UploadItem): string | null => {
    return referenceLabel(slots, item)
  }

  const handleRemove = (): void => {
    props.onRemove(id)
  }

  const handlePreview = (): void => {
    const index = previewUploads.findIndex((item) => {
      return item.id === id
    })

    openPreview({
      items: previewUploads,
      index,
      allowUse: false,
      actions: {
        insert: handleInsert,
        replace: handleReplace,
        remove: handleRemoveAction,
        label: handleLabel,
      },
    })
  }

  const canPreview = !isNil(upload)
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
