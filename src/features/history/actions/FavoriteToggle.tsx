'use client'

import { cn } from '@/lib/cn'

import { useHistoryViewStore } from '../list/view-store'

/** Favorites-only switch row. */
export function FavoriteToggle() {
  const filters = useHistoryViewStore((state) => {
    return state.filters
  })

  const setFilters = useHistoryViewStore((state) => {
    return state.setFilters
  })

  const handleToggle = () => {
    if (filters.favorite === true) {
      setFilters({ favorite: undefined })

      return
    }

    setFilters({ favorite: true })
  }

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
          filters.favorite === true && 'bg-lime',
          !(filters.favorite === true) && 'bg-white/15',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-3 rounded-full bg-page transition-transform',
            filters.favorite === true && 'left-3.5',
            !(filters.favorite === true) && 'left-0.5',
          )}
        />
      </span>
    </button>
  )
}
