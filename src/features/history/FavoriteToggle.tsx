'use client'

import { useCallback } from 'react'

import { cn } from '@/lib/cn'

import { useHistoryViewStore } from './view-store'

/** Favorites-only switch row. */
export function FavoriteToggle() {
  const filters = useHistoryViewStore((state) => state.filters)
  const setFilters = useHistoryViewStore((state) => state.setFilters)
  const handleToggle = useCallback(
    () => setFilters({ favorite: filters.favorite === true ? undefined : true }),
    [filters.favorite, setFilters],
  )

  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(filters.favorite)}
      onClick={handleToggle}
      className="flex w-full items-center justify-between px-1 text-xs text-fg-2 transition hover:text-fg"
    >
      Favorites only
      <span
        className={cn(
          'relative h-4 w-7 rounded-full transition-colors',
          filters.favorite === true ? 'bg-lime' : 'bg-white/15',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-3 rounded-full bg-page transition-transform',
            filters.favorite === true ? 'left-3.5' : 'left-0.5',
          )}
        />
      </span>
    </button>
  )
}
