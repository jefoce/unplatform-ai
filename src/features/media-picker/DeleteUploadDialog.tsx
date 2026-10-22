'use client'

import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'

interface DeleteUploadDialogProps {
  isOpen: boolean
  isDeleting: boolean
  onOpenChange: (isOpen: boolean) => void
  onCancel: () => void
  onConfirm: () => void
}

/** Confirmation dialog for deleting an upload. */
export function DeleteUploadDialog(props: DeleteUploadDialogProps) {
  const { isOpen, isDeleting, onOpenChange, onCancel, onConfirm } = props
  const handleOpenChange = onOpenChange
  const handleCancel = onCancel
  const handleConfirm = onConfirm

  return (
    <Modal
      open={isOpen}
      onOpenChange={handleOpenChange}
      label="Delete upload?"
      className="w-[min(360px,90vw)] p-5"
    >
      <h2 className="text-sm font-semibold text-fg">Delete upload?</h2>
      <p className="mt-1 text-sm text-fg-2">
        Removes the app copy. Linked files keep the original on disk.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={handleCancel}>
          Cancel
        </Button>
        <Button size="sm" variant="danger" loading={isDeleting} onClick={handleConfirm}>
          Delete
        </Button>
      </div>
    </Modal>
  )
}
