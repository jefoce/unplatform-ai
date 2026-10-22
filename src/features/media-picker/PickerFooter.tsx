'use client'

import { Button } from '@/ui/Button'

const HINT = 'Choose from disk links files without copying. Pasted and dropped files are copied.'

interface PickerFooterProps {
  max: number
  selectedCount: number
  isBusy: boolean
  onConfirm: () => void
}

/** Hint plus the multi-select confirm button. */
export function PickerFooter(props: PickerFooterProps) {
  const { max, selectedCount, isBusy, onConfirm } = props
  const handleConfirm = onConfirm

  return (
    <div className="mt-3 flex shrink-0 items-center justify-between gap-3 px-3 py-2">
      <p className="text-xs text-fg-2">{HINT}</p>
      {max > 1 && (
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs text-fg-2">{selectedCount} selected</span>
          <Button
            size="sm"
            variant="primary"
            disabled={selectedCount === 0}
            loading={isBusy}
            onClick={handleConfirm}
          >
            Add
          </Button>
        </div>
      )}
    </div>
  )
}
