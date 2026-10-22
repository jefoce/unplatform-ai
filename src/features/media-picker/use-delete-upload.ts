'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import type { UploadItem } from '@/core/types'
import { errorMessage } from '@/lib/errors'

import { deleteUpload } from './api'

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
  handleConfirmDelete: () => void
}

/** Delete confirmation state for the uploads grid. */
export function useDeleteUpload(params: UseDeleteUploadParams): DeleteUpload {
  const { mutate, onDeleted } = params
  const [pending, setPending] = useState<UploadItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = useCallback(async () => {
    if (!pending) return

    setIsDeleting(true)

    try {
      await deleteUpload(pending.id)
      await mutate()
      onDeleted?.(pending.id)
      toast.success('Upload deleted')
      setPending(null)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setIsDeleting(false)
    }
  }, [mutate, onDeleted, pending])

  const handleDeleteRequest = useCallback((item: UploadItem) => setPending(item), [])
  const handlePendingOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) setPending(null)
  }, [])
  const handleCancelDelete = useCallback(() => setPending(null), [])
  const handleConfirmDelete = useCallback(() => void handleDelete(), [handleDelete])

  return {
    pending,
    isDeleting,
    handleDeleteRequest,
    handlePendingOpenChange,
    handleCancelDelete,
    handleConfirmDelete,
  }
}
