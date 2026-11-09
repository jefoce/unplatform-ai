'use client'

import { isEmpty, isNil } from 'lodash-es'
import { Check, Clock, Film, Monitor, TriangleAlert, Volume2 } from 'lucide-react'

import { cn } from '@/lib/cn'
import { EndpointBadge } from '@/ui/EndpointBadge'
import { Tooltip } from '@/ui/Tooltip'

import type { ModelRowProps } from './model-row-props'
import { ModelBadge } from './ModelBadge'
import type { PickerRow } from './picker-groups'

interface ModelCustomRowProps extends ModelRowProps {
  model: PickerRow
}

type RowState = 'ok' | 'stale' | 'invalid' | 'unreachable'

function rowState(row: PickerRow): RowState {
  if (row.status === 'invalid') {
    return 'invalid'
  }

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

/** ComfyUI row: badge chip, title, description and availability state. */
// eslint-disable-next-line complexity -- one row owns badge, state, price and tooltip
export function ModelCustomRow(props: ModelCustomRowProps) {
  const { model, selected: isSelected } = props
  const state = rowState(model)
  const isBlocked = state === 'unreachable' || state === 'invalid' || model.status === 'missing'
  const price = rowPrice(model, state)
  const note = rowNote(state)
  const reason = model.reason ?? ''
  const hasDescription = !isEmpty(model.description)

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
        'flex w-full items-center gap-2 rounded-lg p-2 text-left',
        !isBlocked && 'hover:bg-white/6',
        isSelected && 'bg-white/6',
        isBlocked && 'opacity-50',
      )}
    >
      {!isNil(model.badge) && <EndpointBadge badge={model.badge} />}
      <span className="min-w-0 flex-1">
        <span className="flex w-full items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium whitespace-nowrap">
            {model.title}
            {!isNil(note) && <span className="text-fg-2">{note}</span>}
          </span>
          {state === 'stale' && (
            <Tooltip content={reason}>
              <span tabIndex={0} aria-label={reason} className="shrink-0 text-amber">
                <TriangleAlert size={14} aria-hidden />
              </span>
            </Tooltip>
          )}
          {!isNil(price) && (
            <span className="ml-auto shrink-0 text-xs whitespace-nowrap text-fg-2">{price}</span>
          )}
        </span>
        {hasDescription && (
          <span className="mt-1 block truncate text-xs text-fg-2">{model.description}</span>
        )}
        {state !== 'stale' && !isNil(model.reason) && (
          <span className="mt-1 block text-xs text-fg-2">{model.reason}</span>
        )}
        {model.mediaKind === 'video' && (
          <span className="mt-1 flex flex-wrap gap-1">
            {!isNil(model.resolutionText) && (
              <ModelBadge icon={Monitor} text={model.resolutionText} />
            )}
            {!isNil(model.durationText) && <ModelBadge icon={Clock} text={model.durationText} />}
            {model.hasAudio && <ModelBadge icon={Volume2} label="Audio" />}
            {model.referenceCount > 0 && (
              <ModelBadge icon={Film} text={`${model.referenceCount} refs`} />
            )}
          </span>
        )}
      </span>
      <span className="flex size-3.5 shrink-0 items-center justify-center">
        <Check size={14} className={cn('text-accent', !isSelected && 'invisible')} />
      </span>
    </button>
  )
}
