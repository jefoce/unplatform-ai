'use client'

import { DndContext } from '@dnd-kit/core'
import { SortableContext, type SortingStrategy } from '@dnd-kit/sortable'

import { referenceCollisionDetection } from '@/features/generator/references/reference-collision'

import { ImageReferenceItem } from './ImageReferenceItem'
import { useImageGeneratorStore } from './store'
import { useImageReferencesDnd } from './use-image-references-dnd'

interface ImageReferencesProps {
  isUploadsLoading?: boolean
}

/** Chips keep their natural slots, no transform shifting during drag. */
const noSortStrategy: SortingStrategy = () => {
  return null
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
      collisionDetection={referenceCollisionDetection}
      onDragStart={dnd.handleDragStart}
      onDragOver={dnd.handleDragOver}
      onDragEnd={dnd.handleDragEnd}
      onDragCancel={dnd.handleDragCancel}
    >
      <div className="flex h-16 items-center gap-2" data-image-references>
        <SortableContext items={dnd.order} strategy={noSortStrategy}>
          {dnd.order.map((id) => {
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
