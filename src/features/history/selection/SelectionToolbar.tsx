'use client'

import { Download, Trash2, X } from 'lucide-react'

import type { RecordKind } from '@/core/feed/grid-item'
import { cn } from '@/lib/cn'
import type { HistoryItem } from '@/lib/feed/output-items'
import { Tooltip } from '@/ui/Tooltip'

import { SelectionStack } from './SelectionStack'

const ACTION_BUTTON_CLASSES =
  'inline-flex h-10 items-center justify-center rounded-xl bg-white/5 text-sm font-medium text-fg transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40'

const NOUN = {
  image: 'images',
  video: 'videos',
} satisfies Record<RecordKind, string>

interface SelectionToolbarProps {
  isActive: boolean
  count: number
  kind: RecordKind
  stack: string[]
  byId: Map<string, HistoryItem>
  completedCount: number
  isBusy: boolean
  onDownload: () => void
  onDelete: () => void
  onClear: () => void
}

/** Floating batch actions for the current selection. */
export function SelectionToolbar(props: SelectionToolbarProps) {
  const { isActive, count, kind, stack, byId, completedCount, isBusy } = props

  const noun = NOUN[kind]
  const canDownload = completedCount > 0

  const downloadTitle = canDownload
    ? `Download ${completedCount} selected ${noun}`
    : 'Nothing finished to download'

  return (
    <div
      role="toolbar"
      aria-label={`Selected ${noun}`}
      inert={!isActive}
      className={cn(
        'absolute bottom-6 left-1/2 z-40 flex h-14 -translate-x-1/2 items-center gap-1.5 rounded-2xl border border-line-strong bg-surface-2/95 p-2 shadow-selection backdrop-blur-sm transition duration-150 ease-out linux:bg-surface-2',
        isActive && 'translate-y-0 opacity-100',
        !isActive && 'translate-y-2 opacity-0',
        !isActive && 'pointer-events-none',
      )}
    >
      <SelectionStack stack={stack} byId={byId} />

      <span
        aria-live="polite"
        className="w-24 shrink-0 text-sm font-medium whitespace-nowrap text-fg tabular-nums"
      >
        {count} selected
      </span>

      <Tooltip content={downloadTitle}>
        <span className="inline-flex">
          <button
            type="button"
            className={cn(ACTION_BUTTON_CLASSES, 'gap-1.5 px-3.5')}
            disabled={!canDownload || isBusy}
            onClick={props.onDownload}
          >
            <Download size={15} aria-hidden />
            Download {completedCount}
          </button>
        </span>
      </Tooltip>

      <button
        type="button"
        className={cn(ACTION_BUTTON_CLASSES, 'w-10')}
        disabled={isBusy}
        onClick={props.onDelete}
        aria-label={`Delete selected ${noun}`}
        title={`Delete selected ${noun}`}
      >
        <Trash2 size={15} aria-hidden />
      </button>

      <button
        type="button"
        aria-label="Clear selection"
        title="Clear selection"
        onClick={props.onClear}
        className={cn(ACTION_BUTTON_CLASSES, 'w-10')}
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  )
}
