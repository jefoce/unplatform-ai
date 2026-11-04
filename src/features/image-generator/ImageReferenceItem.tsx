'use client'

import type { UploadItem } from '@/core/schemas/upload-item'
import { referenceUploads } from '@/features/generator/references/reference-notes'
import { SortableReference } from '@/features/generator/references/SortableReference'
import { type ActionKey, openPreview } from '@/features/preview/preview-store'

import { openImageReplacePicker } from './image-picker'
import { useImageGeneratorStore } from './store'

function availablePreviewActions(): ActionKey[] {
  return ['remove', 'replace']
}

interface ImageReferenceItemProps {
  id: string
  upload?: UploadItem
  isUploadsLoading?: boolean
}

/** One sortable image reference with preview, replace and remove. */
export function ImageReferenceItem(props: ImageReferenceItemProps) {
  const { id, upload, isUploadsLoading } = props

  const references = useImageGeneratorStore((state) => {
    return state.references
  })

  const uploadsById = useImageGeneratorStore((state) => {
    return state.uploadsById
  })

  const removeReference = useImageGeneratorStore((state) => {
    return state.removeReference
  })

  const handleRemove = (): void => {
    removeReference(id)
  }

  const handleRemoveAction = (item: UploadItem): boolean => {
    removeReference(item.id)

    return true
  }

  const handleReplace = (): void => {
    openImageReplacePicker(id)
  }

  const handlePreview = (): void => {
    const items = referenceUploads(references, uploadsById)

    const index = items.findIndex((item) => {
      return item.id === id
    })

    openPreview({
      items,
      index,
      allowUse: false,
      actions: {
        remove: handleRemoveAction,
        replace: handleReplace,
        available: availablePreviewActions,
      },
    })
  }

  return (
    <SortableReference
      id={id}
      upload={upload}
      className="size-16 shrink-0"
      isUploadsLoading={isUploadsLoading}
      onOpenPreview={handlePreview}
      onRemove={handleRemove}
    />
  )
}
