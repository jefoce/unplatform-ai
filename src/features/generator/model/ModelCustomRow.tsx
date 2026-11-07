'use client'

import { isNil } from 'lodash-es'
import { Check, TriangleAlert } from 'lucide-react'

import { cn } from '@/lib/cn'
import { Tooltip } from '@/ui/Tooltip'

import type { ModelRowProps } from './model-row-props'
import type { PickerRow } from './picker-groups'

type RowState = 'ok' | 'stale' | 'unreachable'

function rowState(row: PickerRow): RowState {
  if (row.status === 'unverified') {
    return 'unreachable'
  }

  if (row.status === 'available' && !isNil(row.reason)) {
    return 'stale'
  }

  return 'ok'
}

function rowPrice(row: PickerRow, state: RowState): string | null {
  if (state === 'unreachable' || row.priceText === '') {
    return null
  }

  return row.priceText
}

function rowNote(state: RowState): string | null {
  if (state === 'unreachable') {
    return '(unreachable)'
  }

  return null
}

/** ComfyUI row: badge chip, title, workflow subtitle and availability state. */
// eslint-disable-next-line complexity -- one row owns badge, state, price and tooltip
export function ModelCustomRow(props: ModelRowProps) {
  const { model, selected: isSelected } = props
  const state = rowState(model)
  const isBlocked = state === 'unreachable' || model.status === 'missing'
  const price = rowPrice(model, state)
  const note = rowNote(state)

  const handleSelect = (): void => {
    if (isBlocked) {
      return
    }

    props.onSelect(model.id)
  }

  return (
    <Tooltip content={model.reason ?? ''} disabled={isNil(model.reason)}>
      <button
        type="button"
        onClick={handleSelect}
        disabled={isBlocked}
        aria-pressed={isSelected}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg p-2 text-left',
          !isBlocked && 'hover:bg-white/6',
          isSelected && 'bg-white/6',
          isBlocked && 'opacity-50',
        )}
      >
        <span className="flex h-6 w-10 shrink-0 items-center justify-center rounded-md bg-white/5 font-mono text-xs text-fg-2">
          {model.badge}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex w-full items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium whitespace-nowrap">
              {model.title}
              {!isNil(note) && <span className="text-fg-2">{note}</span>}
            </span>
            {state === 'stale' && <TriangleAlert size={14} className="text-amber" aria-hidden />}
            {!isNil(price) && (
              <span className="ml-auto shrink-0 text-xs whitespace-nowrap text-fg-2">{price}</span>
            )}
          </span>
          {!isNil(model.workflowName) && (
            <span className="mt-1 block truncate text-xs text-fg-2">{model.workflowName}</span>
          )}
        </span>
        <span className="flex size-3.5 shrink-0 items-center justify-center">
          <Check size={14} className={cn('text-accent', !isSelected && 'invisible')} />
        </span>
      </button>
    </Tooltip>
  )
}
