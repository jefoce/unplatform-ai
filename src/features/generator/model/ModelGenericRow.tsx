'use client'

import { isNil } from 'lodash-es'
import { Check } from 'lucide-react'

import { cn } from '@/lib/cn'

import { isBlockedEntry, type ModelRowProps } from './model-row-props'
import { PRESET_ICONS } from './preset-icon'

/** Blocked rows show the catalog reason, healthy rows show the description. */
function noteOf(params: ModelRowProps, isBlocked: boolean): string | null {
  const { model, entry = null } = params

  if (isBlocked) {
    return entry?.reason ?? null
  }

  return model.description
}

/** Image or any non-video row, showing the adapter description and price text. */
export function ModelGenericRow(props: ModelRowProps) {
  const { model, entry = null, selected: isSelected } = props
  const Icon = PRESET_ICONS[model.icon]
  const isBlocked = isBlockedEntry(entry)
  const note = noteOf(props, isBlocked)

  const handleSelect = (): void => {
    if (isBlocked) {
      return
    }

    props.onSelect(model.id)
  }

  return (
    <button
      type="button"
      onClick={handleSelect}
      disabled={isBlocked}
      aria-pressed={isSelected}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg p-2 text-left',
        !isBlocked && 'hover:bg-white/6',
        isSelected && 'bg-white/6',
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-fg-2">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex w-full items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium whitespace-nowrap">
            {model.title}
          </span>
          {model.priceText !== '' && (
            <span className="ml-auto shrink-0 text-xs whitespace-nowrap text-fg-2">
              {model.priceText}
            </span>
          )}
        </span>
        {!isNil(note) && note !== '' && (
          <span className="mt-1 block text-xs text-fg-2">{note}</span>
        )}
      </span>
      <span className="flex size-3.5 shrink-0 items-center justify-center">
        <Check size={14} className={cn('text-accent', !isSelected && 'invisible')} />
      </span>
    </button>
  )
}
