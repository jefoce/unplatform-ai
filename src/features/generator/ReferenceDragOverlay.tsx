'use client'

import { DragOverlay } from '@dnd-kit/core'
import { isNil } from 'lodash-es'

import type { RefSlot } from '@/core/prompt-tokens'
import type { UploadItem } from '@/core/types'
import type { PickerExtensions } from '@/features/media-picker/store'

import { labelFor, noteFor, type PlannedImage } from './reference-notes'
import { ReferenceItem } from './ReferenceItem'

interface ReferenceDragOverlayProps {
  activeId: string | null
  uploadsById: Record<string, UploadItem>
  planned: Record<string, PlannedImage>
  slots: Map<string, RefSlot>
  previewUploads: UploadItem[]
  extensions?: PickerExtensions
  onSelectSlot: (slot: RefSlot) => void
  onReplace: (id: string, upload: UploadItem) => void
  onRemove: (id: string) => void
}

/** Lifted tile shown under the pointer while dragging a reference. */
export function ReferenceDragOverlay(props: ReferenceDragOverlayProps) {
  const {
    activeId,
    uploadsById,
    planned,
    slots,
    previewUploads,
    extensions,
    onSelectSlot: handleSelectSlot,
    onReplace: handleReplace,
    onRemove: handleRemove,
  } = props

  return (
    <DragOverlay>
      {!isNil(activeId) && (
        <ReferenceItem
          id={activeId}
          upload={uploadsById[activeId]}
          label={labelFor(slots, activeId)}
          note={noteFor({ id: activeId, planned })}
          previewUploads={previewUploads}
          slots={slots}
          extensions={extensions}
          onSelectSlot={handleSelectSlot}
          onReplace={handleReplace}
          onRemove={handleRemove}
          isLifted
        />
      )}
    </DragOverlay>
  )
}
