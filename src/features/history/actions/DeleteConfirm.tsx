'use client'

import { toast } from 'sonner'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import { deleteGeneration } from '@/lib/api/generations'
import { ApiError } from '@/lib/fetcher'
import { toastError } from '@/lib/notify'
import { useAsyncAction } from '@/lib/use-async-action'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'

import { revalidateHistory } from '../list/history-pages'

interface DeleteConfirmProps {
  record: GenerationRecord
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

/** Delete confirmation, refuses active jobs and refreshes every list page. */
export function DeleteConfirm(props: DeleteConfirmProps) {
  const { record, open: isOpen } = props

  const deletion = useAsyncAction(async () => {
    try {
      await deleteGeneration(record.id)
      toast.success('Deleted')
      await revalidateHistory()
      props.onOpenChange(false)
      props.onDeleted?.()
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error('Cannot delete while generating')

        return
      }

      toastError(error)
    }
  })

  const handleCancel = () => {
    props.onOpenChange(false)
  }

  return (
    <Modal open={isOpen} onOpenChange={props.onOpenChange} label="Delete video" className="w-100">
      <div className="p-5">
        <h2 className="text-sm font-semibold text-fg">Delete video?</h2>
        <p className="mt-2 text-sm text-fg-2">
          Delete this video and its files? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button size="sm" variant="danger" loading={deletion.isRunning} onClick={deletion.run}>
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  )
}
