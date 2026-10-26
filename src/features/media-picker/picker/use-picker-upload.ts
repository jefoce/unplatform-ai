'use client'

import { useCallback } from 'react'
import { useSWRConfig } from 'swr'

import type { UploadItem } from '@/core/schemas/upload-item'

import { type DropProps, useDropUpload } from '../uploads/use-drop-upload'
import { usePasteMedia } from '../uploads/use-paste-media'
import { type UploadQueue, useUploadQueue } from '../uploads/use-upload-queue'
import { type PickerRequest, useMediaPickerStore } from './store'

interface UsePickerUploadParams {
  request: PickerRequest
  onCommit: (items: UploadItem[]) => void
}

export interface PickerUpload {
  queue: UploadQueue
  isDragging: boolean
  dropProps: DropProps
  handleUploaded: (items: UploadItem[]) => void
}

/** Upload queue, drag and paste wiring for the picker body. */
export function usePickerUpload(params: UsePickerUploadParams): PickerUpload {
  const { request, onCommit } = params
  const { mutate } = useSWRConfig()

  const refreshUploads = useCallback(() => {
    void mutate(
      (key) => {
        return Array.isArray(key) && key[0] === 'uploads'
      },
      undefined,
      {
        revalidate: true,
      },
    )
  }, [mutate])

  const handleUploaded = useCallback(
    (items: UploadItem[]) => {
      if (request !== useMediaPickerStore.getState().request) {
        return
      }

      refreshUploads()
      onCommit(items)
    },
    [onCommit, refreshUploads, request],
  )

  const queue = useUploadQueue(handleUploaded)

  const { dragging: isDragging, dropProps } = useDropUpload({
    id: 'picker',
    enabled: true,
    kinds: request.kinds,
    extensions: request.extensions,
    onUploaded: handleUploaded,
    onFiles: queue.enqueue,
  })

  const readKinds = () => {
    return request.kinds
  }

  const readExtensions = () => {
    return request.extensions
  }

  usePasteMedia({
    enabled: true,
    scope: 'window',
    kinds: readKinds,
    extensions: readExtensions,
    onFiles: queue.enqueue,
    onUploaded: handleUploaded,
  })

  return { queue, isDragging, dropProps, handleUploaded }
}
