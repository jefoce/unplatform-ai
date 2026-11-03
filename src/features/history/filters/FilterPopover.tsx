'use client'

import { SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'

import { Popover, PopoverContent, PopoverTrigger } from '@/ui/Popover'

interface FilterPopoverProps {
  activeCount: number
  children: ReactNode
}

/** Filter button that hosts the active feed's form. */
export function FilterPopover(props: FilterPopoverProps) {
  const { activeCount } = props

  return (
    // Multi-toggle panel: stays open until click outside or Escape.
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 w-24 items-center justify-center gap-1.5 rounded-control bg-veil px-2 py-1 text-sm font-medium text-fg-2 transition hover:bg-surface-2 hover:text-fg"
        >
          <SlidersHorizontal size={16} aria-hidden />
          Filter
          <span className="inline-flex h-4 min-w-4 items-center justify-center">
            {activeCount > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-xxs font-semibold text-on-accent">
                {activeCount}
              </span>
            )}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        {props.children}
      </PopoverContent>
    </Popover>
  )
}
