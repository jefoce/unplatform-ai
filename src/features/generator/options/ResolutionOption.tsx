'use client'

import { isNil } from 'lodash-es'
import { Check } from 'lucide-react'

import { formatRate } from '@/core/pricing/format'
import { cn } from '@/lib/cn'
import { PopoverClose } from '@/ui/Popover'
import { Price } from '@/ui/Price'
import { Tooltip } from '@/ui/Tooltip'

interface ResolutionOptionProps {
  option: string
  label: string
  detail: string | null
  isSelected: boolean
  rate: number | null
  listRate: number | null
  discount: number
  onSelect: (option: string) => void
}

/** One resolution row with its per-second rate. */
export function ResolutionOption(props: ResolutionOptionProps) {
  const { option, label, detail, isSelected, rate, listRate, discount } = props

  const handleSelect = (): void => {
    props.onSelect(option)
  }

  return (
    <PopoverClose asChild>
      <button
        type="button"
        onClick={handleSelect}
        className={cn(
          'flex min-h-9 w-full items-center gap-2 rounded-lg p-2 text-sm font-medium',
          isSelected && 'text-accent',
          !isSelected && 'text-fg hover:bg-white/5',
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0">{label}</span>
          {!isNil(detail) && <span className="shrink-0 text-xs text-fg-2">{detail}</span>}
          {isNil(rate) && (
            <Tooltip content="Price varies for this model">
              <span className="ml-auto text-xs text-fg-2 tabular-nums">--</span>
            </Tooltip>
          )}
          {!isNil(rate) && (
            <span className="ml-auto shrink-0 text-xs">
              <Price current={rate} list={listRate} discount={discount} format={formatRate} />
            </span>
          )}
        </span>
        <span className="flex size-3.5 shrink-0 items-center justify-center">
          <Check size={14} className={cn('text-accent', !isSelected && 'invisible')} />
        </span>
      </button>
    </PopoverClose>
  )
}
