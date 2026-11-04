'use client'

import { isNil } from 'lodash-es'
import { toast } from 'sonner'

import { ApiError } from '@/lib/fetcher'
import { toastError } from '@/lib/notify'
import { useAsyncAction } from '@/lib/use-async-action'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'

interface DeleteConfirmProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  label: string
  title: string
  description: string
  confirmLabel?: string
  isDanger?: boolean
  successMessage?: string | null
  onConfirm: () => Promise<void>
  onDeleted?: () => void
}

/** Shared alert dialog for deletes and paid resubmits. */
export function DeleteConfirm(props: DeleteConfirmProps) {
  const {
    open: isOpen,
    label,
    title,
    description,
    confirmLabel = 'Delete',
    isDanger = true,
    successMessage = 'Deleted',
  } = props

  const confirmation = useAsyncAction(async () => {
    try {
      await props.onConfirm()

      if (!isNil(successMessage)) {
        toast.success(successMessage)
      }

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

  const confirmVariant = isDanger ? 'danger' : 'primary'

  return (
    <Modal open={isOpen} onOpenChange={props.onOpenChange} label={label} className="w-100">
      <div className="p-5">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        <p className="mt-2 text-sm text-fg-2">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant={confirmVariant}
            loading={confirmation.isRunning}
            onClick={confirmation.run}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
