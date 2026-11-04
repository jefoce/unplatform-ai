'use client'

import { Eraser } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/cn'
import { BAR_ICON_CLASSES } from '@/ui/Chip'
import { Tooltip } from '@/ui/Tooltip'

export type ClearDraftUndo = () => void

type ClearDraftVariant = 'ghost' | 'bar'

interface ClearDraftButtonProps {
  isDisabled: boolean
  onClear: () => ClearDraftUndo
  variant?: ClearDraftVariant
}

const VARIANTS = {
  ghost:
    'flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-2 transition hover:bg-white/5 hover:text-fg',
  bar: BAR_ICON_CLASSES,
} satisfies Record<ClearDraftVariant, string>

/** Icon button that clears the draft and offers one Undo. */
export function ClearDraftButton(props: ClearDraftButtonProps) {
  const { isDisabled, variant = 'ghost' } = props

  const handleClear = (): void => {
    const undo = props.onClear()

    toast('Cleared', {
      duration: 5000,
      action: { label: 'Undo', onClick: undo },
    })
  }

  return (
    <Tooltip content="Clear prompt and inputs">
      <button
        type="button"
        data-clear-draft
        aria-label="Clear prompt and inputs"
        disabled={isDisabled}
        onClick={handleClear}
        className={cn(VARIANTS[variant], 'disabled:pointer-events-none disabled:opacity-40')}
      >
        <Eraser size={14} aria-hidden />
      </button>
    </Tooltip>
  )
}
