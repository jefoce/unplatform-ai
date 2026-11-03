'use client'

import { DeleteConfirm } from './DeleteConfirm'

interface RegenerateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  description: string
  onConfirm: () => Promise<void>
}

/** Paid resubmit confirmation, same alert as delete without the danger tone. */
export function RegenerateDialog(props: RegenerateDialogProps) {
  return (
    <DeleteConfirm
      open={props.open}
      onOpenChange={props.onOpenChange}
      label="Regenerate"
      title="Regenerate?"
      description={props.description}
      confirmLabel="Regenerate"
      isDanger={false}
      successMessage={null}
      onConfirm={props.onConfirm}
    />
  )
}
