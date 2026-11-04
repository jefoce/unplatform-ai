'use client'

import { Minus, Plus } from 'lucide-react'

import { IMAGE_COUNT_MAX } from '@/core/constants'
import { cn } from '@/lib/cn'
import { BAR_CONTROL_CLASSES } from '@/ui/Chip'

interface ImageCountStepperProps {
  count: number
  onChange: (count: number) => void
}

const STEP_BUTTON_CLASSES =
  'flex size-6 items-center justify-center rounded-md text-fg-2 transition hover:bg-white/10 hover:text-fg disabled:pointer-events-none disabled:opacity-40'

/** `- 1/4 +` count chip, capped by IMAGE_COUNT_MAX. */
export function ImageCountStepper(props: ImageCountStepperProps) {
  const { count } = props

  const handleDecrease = (): void => {
    props.onChange(count - 1)
  }

  const handleIncrease = (): void => {
    props.onChange(count + 1)
  }

  return (
    <div className={cn('flex shrink-0 items-center gap-1', BAR_CONTROL_CLASSES)}>
      <button
        type="button"
        aria-label="Decrease image count"
        disabled={count <= 1}
        onClick={handleDecrease}
        className={STEP_BUTTON_CLASSES}
      >
        <Minus size={12} aria-hidden />
      </button>
      <span aria-live="polite" className="w-8 text-center whitespace-nowrap tabular-nums">
        <span className="font-semibold text-fg">{count}</span>
        <span className="text-fg-2">/{IMAGE_COUNT_MAX}</span>
      </span>
      <button
        type="button"
        aria-label="Increase image count"
        disabled={count >= IMAGE_COUNT_MAX}
        onClick={handleIncrease}
        className={STEP_BUTTON_CLASSES}
      >
        <Plus size={12} aria-hidden />
      </button>
    </div>
  )
}
