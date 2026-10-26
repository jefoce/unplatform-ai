'use client'

import { PopoverClose } from '@/ui/Popover'
import { Tooltip } from '@/ui/Tooltip'

interface ChipClassParams {
  value: number
  duration: number
  limit: number
}

function chipClass(params: ChipClassParams): string {
  const { value, duration, limit } = params
  const base = 'h-8 rounded-md px-2 text-xs font-medium'

  if (value > limit) {
    return `${base} bg-white/5 text-fg-2 opacity-40`
  }

  if (value === duration) {
    return `${base} bg-lime/15 text-lime`
  }

  return `${base} bg-white/5 text-fg-2 hover:text-fg`
}

interface DurationChipProps {
  value: number
  duration: number
  limit: number
  limitText: string
  onSelect: (value: number) => void
}

/** One quick-duration chip, disabled when the reference video caps it. */
export function DurationChip(props: DurationChipProps) {
  const { value, duration, limit, limitText } = props
  const isOverLimit = value > limit

  const handleSelect = (): void => {
    props.onSelect(value)
  }

  const tooltip = isOverLimit ? limitText : null

  return (
    <Tooltip content={tooltip}>
      <span className="inline-flex">
        <PopoverClose asChild>
          <button
            type="button"
            disabled={isOverLimit}
            onClick={handleSelect}
            className={chipClass({ value, duration, limit })}
          >
            {value}s
          </button>
        </PopoverClose>
      </span>
    </Tooltip>
  )
}
