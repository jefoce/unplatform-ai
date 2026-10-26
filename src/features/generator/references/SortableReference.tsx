'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import type { UploadItem } from '@/core/schemas/upload-item'
import { cn } from '@/lib/cn'

import { ReferenceThumb } from './ReferenceThumb'

interface SortableReferenceProps {
  id: string
  upload?: UploadItem
  label?: string
  note?: string
  onOpenPreview?: () => void
  onRemove: () => void
}

/** Grid cell that owns the sort transform and pointer/keyboard listeners. */
export function SortableReference(props: SortableReferenceProps) {
  const { id, upload, label, note } = props

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  const isAudio = upload?.kind === 'audio'

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        isAudio && 'col-span-2 aspect-[2.12/1]',
        !isAudio && 'aspect-square',
        isDragging && 'rounded-xl opacity-30 outline-1 outline-lime/60 outline-dashed',
      )}
      {...attributes}
      {...listeners}
    >
      <ReferenceThumb
        upload={upload}
        label={label}
        note={note}
        onOpenPreview={props.onOpenPreview}
        onRemove={props.onRemove}
      />
    </div>
  )
}
