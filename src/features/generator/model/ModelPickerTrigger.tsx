import { ChevronRight } from 'lucide-react'

import { PopoverTrigger } from '@/ui/Popover'
import { discountLabel } from '@/ui/Price'

interface ModelPickerTriggerProps {
  title: string
  discount: number
}

/** Button that opens the model picker. */
export function ModelPickerTrigger(props: ModelPickerTriggerProps) {
  const { title, discount } = props

  return (
    <PopoverTrigger asChild>
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-xl bg-surface px-4 py-3 text-left hover:bg-white/6"
      >
        <span className="flex flex-col">
          <span className="flex items-center gap-2 text-xs text-fg-2">
            Model
            {discount > 0 && <span className="text-xxs text-lime">{discountLabel(discount)}</span>}
          </span>
          <span className="text-sm font-medium">{title}</span>
        </span>
        <ChevronRight size={16} className="text-fg-2" />
      </button>
    </PopoverTrigger>
  )
}
