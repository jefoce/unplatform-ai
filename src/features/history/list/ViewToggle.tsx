'use client'

import { type MouseEvent } from 'react'
import { Columns3, Grid2x2, List } from 'lucide-react'

import { isOneOf } from '@/core/guards'
import { cn } from '@/lib/cn'

import { HISTORY_VIEWS, type HistoryView } from './view-store'

interface ViewOption {
  value: HistoryView
  label: string
}

const OPTIONS: ViewOption[] = [
  { value: 'list', label: 'List' },
  { value: 'grid', label: 'Grid' },
  { value: 'masonry', label: 'Masonry' },
]

const ICONS = { list: List, grid: Grid2x2, masonry: Columns3 }

interface ViewToggleProps {
  view: HistoryView
  onViewChange: (view: HistoryView) => void
  views?: readonly HistoryView[]
}

/** List, grid and masonry switch for the history feed. */
export function ViewToggle(props: ViewToggleProps) {
  const { view, views = HISTORY_VIEWS } = props

  const handleSelect = (event: MouseEvent<HTMLButtonElement>) => {
    const next = event.currentTarget.value

    if (!isOneOf(HISTORY_VIEWS, next)) {
      return
    }

    props.onViewChange(next)
  }

  return (
    <div
      role="tablist"
      aria-label="View"
      className="flex h-9 shrink-0 items-center gap-1 rounded-lg bg-page-2 p-0.5"
    >
      {OPTIONS.filter((option) => {
        return views.includes(option.value)
      }).map((option) => {
        const Icon = ICONS[option.value]
        const isActive = option.value === view

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            value={option.value}
            onClick={handleSelect}
            className={cn(
              'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-transparent px-2.5 text-xs font-semibold transition',
              isActive && 'bg-surface text-fg',
              !isActive && 'text-fg-2 hover:text-fg',
            )}
          >
            <span className="inline-flex size-4 shrink-0 items-center justify-center">
              <Icon size={14} aria-hidden />
            </span>
            <span className="whitespace-nowrap">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
