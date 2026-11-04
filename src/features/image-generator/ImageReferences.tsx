'use client'

import { closestCenter, DndContext } from '@dnd-kit/core'
import { rectSortingStrategy, SortableContext } from '@dnd-kit/sortable'

import { ImageReferenceItem } from './ImageReferenceItem'
import { useImageGeneratorStore } from './store'
import { useImageReferencesDnd } from './use-image-references-dnd'

interface ImageReferencesProps {
  isUploadsLoading?: boolean
}

/** Sortable image reference chips above the prompt, hidden when empty. */
export function ImageReferences(props: ImageReferencesProps) {
  const { isUploadsLoading } = props

  const references = useImageGeneratorStore((state) => {
    return state.references
  })

  const uploadsById = useImageGeneratorStore((state) => {
    return state.uploadsById
  })

  const dnd = useImageReferencesDnd()

  if (references.length === 0) {
    return null
  }

  return (
    <DndContext
      sensors={dnd.sensors}
      collisionDetection={closestCenter}
      onDragStart={dnd.handleDragStart}
      onDragEnd={dnd.handleDragEnd}
      onDragCancel={dnd.handleDragCancel}
    >
      <div className="flex h-16 items-center gap-2" data-image-references>
        <SortableContext items={references} strategy={rectSortingStrategy}>
          {references.map((id) => {
            return (
              <ImageReferenceItem
                key={id}
                id={id}
                upload={uploadsById[id]}
                isUploadsLoading={isUploadsLoading}
              />
            )
          })}
        </SortableContext>
      </div>
    </DndContext>
  )
}
