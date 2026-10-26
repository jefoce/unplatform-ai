'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import type { UploadItem } from '@/core/schemas/upload-item'
import { deleteUpload } from '@/lib/api/uploads'
import { toastError } from '@/lib/notify'
import { useAsyncAction } from '@/lib/use-async-action'

interface UseDeleteUploadParams {
  mutate: () => Promise<unknown>
  onDeleted?: (id: string) => void
}

export interface DeleteUpload {
  pending: UploadItem | null
  isDeleting: boolean
  handleDeleteRequest: (item: UploadItem) => void
  handlePendingOpenChange: (isOpen: boolean) => void
  handleCancelDelete: () => void
  handleConfirmDelete: () => Promise<void>
}

/** Delete confirmation state for the uploads grid. */
export function useDeleteUpload(params: UseDeleteUploadParams): DeleteUpload {
  const { mutate, onDeleted } = params
  const [pending, setPending] = useState<UploadItem | null>(null)

  const deleting = useAsyncAction(async () => {
    if (!pending) {
      return
    }

    try {
      await deleteUpload(pending.id)
      await mutate()
      onDeleted?.(pending.id)
      toast.success('Upload deleted')
      setPending(null)
    } catch (error) {
      toastError(error)
    }
  })

  const handleDeleteRequest = useCallback((item: UploadItem) => {
    setPending(item)
  }, [])

  const handlePendingOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      setPending(null)
    }
  }, [])

  const handleCancelDelete = useCallback(() => {
    setPending(null)
  }, [])

  return {
    pending,
    isDeleting: deleting.isRunning,
    handleDeleteRequest,
    handlePendingOpenChange,
    handleCancelDelete,
    handleConfirmDelete: deleting.run,
  }
}
