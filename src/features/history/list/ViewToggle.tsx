'use client'

import { type MouseEvent } from 'react'
import { Grid2x2, List } from 'lucide-react'

import { isOneOf } from '@/core/guards'
import { cn } from '@/lib/cn'

import { HISTORY_VIEWS, type HistoryView, useHistoryViewStore } from './view-store'

interface ViewOption {
  value: HistoryView
  label: string
}

const OPTIONS: ViewOption[] = [
  { value: 'list', label: 'List' },
  { value: 'grid', label: 'Grid' },
]

const ICONS = { list: List, grid: Grid2x2 }

/** List and grid switch for the history feed. */
export function ViewToggle() {
  const view = useHistoryViewStore((state) => {
    return state.view
  })

  const setView = useHistoryViewStore((state) => {
    return state.setView
  })

  const handleSelect = (event: MouseEvent<HTMLButtonElement>) => {
    const next = event.currentTarget.value

    if (!isOneOf(HISTORY_VIEWS, next)) {
      return
    }

    setView(next)
  }

  return (
    <div
      role="tablist"
      aria-label="View"
      className="flex h-9 items-center gap-1 rounded-lg bg-page-2 p-0.5"
    >
      {OPTIONS.map((option) => {
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
              'inline-flex h-8 w-16 items-center justify-center gap-1.5 rounded-lg border border-transparent text-xs font-semibold transition',
              isActive && 'bg-surface text-fg',
              !isActive && 'text-fg-2 hover:text-fg',
            )}
          >
            <Icon size={14} aria-hidden />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
