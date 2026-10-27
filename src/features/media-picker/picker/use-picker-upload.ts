'use client'

import { useCallback } from 'react'
import { isNil } from 'lodash-es'
import { useSWRConfig } from 'swr'

import type { UploadItem } from '@/core/schemas/upload-item'

import { type UploadQueue, useUploadQueue } from '../uploads/use-upload-queue'
import { closeMediaPicker, type PickerRequest, useMediaPickerStore } from './store'

interface UsePickerUploadParams {
  request: PickerRequest
}

export interface PickerUpload {
  queue: UploadQueue
  handleUploaded: (items: UploadItem[]) => void
}

/** Applies uploaded files through the request mode, closing after a pick. */
function applyUploaded(request: PickerRequest, items: UploadItem[]): void {
  if (request.mode.kind === 'toggle') {
    for (const item of items) {
      request.mode.onToggle(item)
    }

    return
  }

  const [item] = items

  if (isNil(item)) {
    return
  }

  request.mode.onPick(item)
  closeMediaPicker()
}

/** Upload queue for the picker upload tile. */
export function usePickerUpload(params: UsePickerUploadParams): PickerUpload {
  const { request } = params
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
      applyUploaded(request, items)
    },
    [refreshUploads, request],
  )

  const queue = useUploadQueue(handleUploaded)

  return { queue, handleUploaded }
}
