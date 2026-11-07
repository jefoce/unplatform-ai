import { isNil } from 'lodash-es'
import { ChevronRight, TriangleAlert } from 'lucide-react'

import { cn } from '@/lib/cn'
import { BAR_CONTROL_CLASSES } from '@/ui/Chip'
import { PopoverTrigger } from '@/ui/Popover'
import { discountLabel } from '@/ui/Price'

import type { PickerRow } from './picker-groups'
import { PRESET_ICONS } from './preset-icon'

export type ModelPickerVariant = 'panel' | 'bar'

interface ModelPickerTriggerProps {
  model: PickerRow
  discount: number
  variant?: ModelPickerVariant
}

function triggerTitle(model: PickerRow): string {
  if (isNil(model.badge)) {
    return model.title
  }

  return `[${model.badge}] ${model.title}`
}

function isWarning(model: PickerRow): boolean {
  return model.isCustom === true && !isNil(model.status) && model.status !== 'available'
}

/** Button that opens the model picker, with the custom endpoint badge. */
export function ModelPickerTrigger(props: ModelPickerTriggerProps) {
  const { model, discount, variant = 'panel' } = props
  const label = discountLabel(discount)
  const title = triggerTitle(model)
  const hasWarning = isWarning(model)

  if (variant === 'bar') {
    const Icon = PRESET_ICONS[model.icon]
    const isCustom = model.isCustom === true

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
          {!isCustom && <Icon size={16} className="shrink-0 text-fg-2" aria-hidden />}
          <span className="whitespace-nowrap">{title}</span>
          {hasWarning && <TriangleAlert size={12} className="shrink-0 text-amber" aria-hidden />}
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
          <span className="flex items-center gap-1.5 text-sm font-medium">
            {title}
            {hasWarning && <TriangleAlert size={12} className="shrink-0 text-amber" aria-hidden />}
          </span>
        </span>
        <ChevronRight size={16} className="text-fg-2" />
      </button>
    </PopoverTrigger>
  )
}
