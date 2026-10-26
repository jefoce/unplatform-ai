'use client'

import { DragOverlay } from '@dnd-kit/core'
import { isNil } from 'lodash-es'

import type { KindExtensions } from '@/core/media-kinds'
import type { ReferencePlanImage } from '@/core/media-types'
import type { RefSlot } from '@/core/prompt-tokens'
import type { UploadItem, UploadsById } from '@/core/schemas/upload-item'
import type { Dict } from '@/core/utility-types'

import { labelFor, noteFor } from './reference-notes'
import { ReferenceItem } from './ReferenceItem'

interface ReferenceDragOverlayProps {
  activeId: string | null
  uploadsById: UploadsById
  planned: Dict<ReferencePlanImage>
  slots: Map<string, RefSlot>
  previewUploads: UploadItem[]
  extensions?: KindExtensions
  onSelectSlot: (slot: RefSlot) => void
  onReplace: (id: string, upload: UploadItem) => void
  onRemove: (id: string) => void
}

/** Lifted tile shown under the pointer while dragging a reference. */
export function ReferenceDragOverlay(props: ReferenceDragOverlayProps) {
  const { activeId, uploadsById, planned, slots, previewUploads, extensions } = props

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
          onSelectSlot={props.onSelectSlot}
          onReplace={props.onReplace}
          onRemove={props.onRemove}
          isLifted
        />
      )}
    </DragOverlay>
  )
}
