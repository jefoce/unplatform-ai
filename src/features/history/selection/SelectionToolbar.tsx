'use client'

import { Download, Heart, Trash2, X } from 'lucide-react'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import { cn } from '@/lib/cn'

import { SelectionStack } from './SelectionStack'

const ACTION_BUTTON_CLASSES =
  'inline-flex h-10 items-center justify-center rounded-xl bg-white/5 text-sm font-medium text-fg transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40'

const MIXED_TITLE = 'Only finished videos can be downloaded or liked.'

interface SelectionToolbarProps {
  isActive: boolean
  count: number
  stack: string[]
  byId: Map<string, GenerationRecord>
  isAllCompleted: boolean
  isAllLiked: boolean
  isBusy: boolean
  onDownload: () => void
  onLike: () => void
  onDelete: () => void
  onClear: () => void
}

/** Floating batch actions for the current selection. */
export function SelectionToolbar(props: SelectionToolbarProps) {
  const { isActive, count, stack, byId, isAllCompleted, isAllLiked, isBusy } = props

  const likeLabel = isAllLiked ? 'Unlike selected videos' : 'Like selected videos'
  const downloadTitle = isAllCompleted ? 'Download selected videos' : MIXED_TITLE
  const likeTitle = isAllCompleted ? likeLabel : MIXED_TITLE

  return (
    <div
      role="toolbar"
      aria-label="Selected videos"
      aria-hidden={!isActive}
      className={cn(
        'absolute bottom-6 left-1/2 z-40 flex h-14 -translate-x-1/2 items-center gap-1.5 rounded-2xl border border-line-strong bg-surface-2/95 p-2 shadow-selection backdrop-blur-sm transition duration-150 ease-out motion-reduce:transition-none',
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

      <button
        type="button"
        className={cn(ACTION_BUTTON_CLASSES, 'gap-1.5 px-3.5')}
        disabled={!isAllCompleted || isBusy}
        onClick={props.onDownload}
        title={downloadTitle}
      >
        <Download size={15} aria-hidden />
        Download
      </button>

      <button
        type="button"
        className={cn(ACTION_BUTTON_CLASSES, 'w-10')}
        disabled={!isAllCompleted || isBusy}
        onClick={props.onLike}
        aria-label={likeLabel}
        title={likeTitle}
      >
        <Heart size={15} className={cn(isAllLiked && 'fill-current text-favorite')} aria-hidden />
      </button>

      <button
        type="button"
        className={cn(ACTION_BUTTON_CLASSES, 'w-10')}
        disabled={isBusy}
        onClick={props.onDelete}
        aria-label="Delete selected videos"
        title="Delete selected videos"
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
