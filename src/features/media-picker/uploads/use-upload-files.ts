'use client'

import { useState } from 'react'
import { isEmpty, isNil } from 'lodash-es'

import type { UploadItem } from '@/core/schemas/upload-item'
import { uploadFilesWithProgress } from '@/lib/api/uploads'
import { toastError } from '@/lib/notify'

function progressPercent(sent: number, total: number): number {
  if (total <= 0) {
    return 0
  }

  return Math.round((sent / total) * 100)
}

/** Uploads picked files and tracks the progress percent. */
export function useUploadFiles(onUploaded: (items: UploadItem[]) => void) {
  const [progress, setProgress] = useState<number | null>(null)
  const isBusy = !isNil(progress)

  const handleFiles = async (files: File[]) => {
    if (isEmpty(files)) {
      return
    }

    setProgress(0)

    const handleProgress = (sent: number, total: number) => {
      setProgress(progressPercent(sent, total))
    }

    try {
      const items = await uploadFilesWithProgress({ files, onProgress: handleProgress })

      onUploaded(items)
    } catch (error) {
      toastError(error)
    } finally {
      setProgress(null)
    }
  }

  return { progress, isBusy, handleFiles }
}
