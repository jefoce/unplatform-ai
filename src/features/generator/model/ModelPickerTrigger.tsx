import { isNil } from 'lodash-es'
import { ChevronRight } from 'lucide-react'

import type { PickerModel } from '@/core/feed/picker-model'
import { cn } from '@/lib/cn'
import { BAR_CONTROL_CLASSES } from '@/ui/Chip'
import { PopoverTrigger } from '@/ui/Popover'
import { discountLabel } from '@/ui/Price'

import { PRESET_ICONS } from './preset-icon'

export type ModelPickerVariant = 'panel' | 'bar'

interface ModelPickerTriggerProps {
  model: PickerModel
  discount: number
  variant?: ModelPickerVariant
}

/** Button that opens the model picker. */
export function ModelPickerTrigger(props: ModelPickerTriggerProps) {
  const { model, discount, variant = 'panel' } = props
  const label = discountLabel(discount)

  if (variant === 'bar') {
    const Icon = PRESET_ICONS[model.icon]

    return (
      <PopoverTrigger asChild>
        <button
          type="button"
          data-model-chip
          className={cn(
            'flex shrink-0 items-center gap-1.5 px-2.5 text-left hover:bg-white/10',
            BAR_CONTROL_CLASSES,
          )}
        >
          <Icon size={16} className="shrink-0 text-fg-2" aria-hidden />
          <span className="whitespace-nowrap">{model.title}</span>
          <ChevronRight size={12} className="shrink-0 text-fg-2" aria-hidden />
        </button>
      </PopoverTrigger>
    )
  }

  return (
    <PopoverTrigger asChild>
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-xl bg-surface px-4 py-3 text-left hover:bg-white/6"
      >
        <span className="flex flex-col">
          <span className="flex items-center gap-2 text-xs text-fg-2">
            Model
            {!isNil(label) && <span className="text-xxs text-accent">{label}</span>}
          </span>
          <span className="text-sm font-medium">{model.title}</span>
        </span>
        <ChevronRight size={16} className="text-fg-2" />
      </button>
    </PopoverTrigger>
  )
}
