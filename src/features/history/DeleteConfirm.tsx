'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import type { GenerationRecord } from '@/core/types'
import { errorMessage } from '@/lib/errors'
import { apiDelete, ApiError } from '@/lib/fetcher'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'

import { revalidateHistory } from './use-history'

interface DeleteConfirmProps {
  record: GenerationRecord
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

/** Delete confirmation, refuses active jobs and refreshes every list page. */
export function DeleteConfirm(props: DeleteConfirmProps) {
  const { record, open: isOpen, onOpenChange: handleOpenChange, onDeleted } = props
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = useCallback(async () => {
    setIsDeleting(true)

    try {
      await apiDelete(`/api/generations/${record.id}`)
      toast.success('Deleted')
      await revalidateHistory()
      handleOpenChange(false)
      onDeleted?.()
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error('Cannot delete while generating')

        return
      }

      toast.error(errorMessage(error))
    } finally {
      setIsDeleting(false)
    }
  }, [record, handleOpenChange, onDeleted])

  const handleCancel = useCallback(() => handleOpenChange(false), [handleOpenChange])

  return (
    <Modal open={isOpen} onOpenChange={handleOpenChange} label="Delete video" className="w-100">
      <div className="p-5">
        <h2 className="text-sm font-semibold text-fg">Delete video?</h2>
        <p className="mt-2 text-sm text-fg-2">
          Delete this video and its files? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button size="sm" variant="danger" loading={isDeleting} onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  )
}
