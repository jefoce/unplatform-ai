'use client'

import { DragOverlay } from '@dnd-kit/core'
import { isNil } from 'lodash-es'

import type { UploadsById } from '@/core/api/uploads'
import type { PixelSize } from '@/core/media/geometry'
import type { KindExtensions } from '@/core/media/media-kinds'
import type { ReferencePlanImage } from '@/core/media/media-types'
import type { RefSlot } from '@/core/prompt-tokens'
import type { UploadItem } from '@/core/schemas/upload-item'
import type { Dict } from '@/core/utility-types'

import { labelFor, noteFor } from './reference-notes'
import { ReferenceItem } from './ReferenceItem'

interface ReferenceDragOverlayProps {
  activeId: string | null
  activeSize: PixelSize | null
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
  const { activeId, activeSize, uploadsById, planned, slots, previewUploads, extensions } = props

  return (
    <DragOverlay>
      {!isNil(activeId) && !isNil(activeSize) && (
        <div data-reference-overlay style={{ width: activeSize.width, height: activeSize.height }}>
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
        </div>
      )}
    </DragOverlay>
  )
}
