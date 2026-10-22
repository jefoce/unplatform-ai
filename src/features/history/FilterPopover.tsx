'use client'

import { SlidersHorizontal } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/ui/Popover'

import { FilterForm } from './FilterForm'

interface FilterPopoverProps {
  activeCount: number
}

/** Filter button with prompt search, favorites, status, mode and presets. */
export function FilterPopover(props: FilterPopoverProps) {
  const { activeCount } = props

  return (
    // Multi-toggle panel: stays open until click outside or Escape.
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-control bg-veil px-3 py-1 text-sm font-medium text-fg-2 transition hover:bg-surface-2 hover:text-fg"
        >
          <SlidersHorizontal size={16} aria-hidden />
          Filter
          {activeCount > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-lime px-1 text-xxs font-semibold text-on-lime">
              {activeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <FilterForm />
      </PopoverContent>
    </Popover>
  )
}
