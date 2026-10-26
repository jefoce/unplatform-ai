'use client'

import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import { debounce } from 'lodash-es'

import { SearchInput } from '@/ui/form/SearchInput'

import { FavoriteToggle } from '../actions/FavoriteToggle'
import { useHistoryViewStore } from '../list/view-store'
import { FilterChoices } from './FilterChoices'

/** Prompt search, favorites switch, choice rows and reset. */
export function FilterForm() {
  const filters = useHistoryViewStore((state) => {
    return state.filters
  })

  const setFilters = useHistoryViewStore((state) => {
    return state.setFilters
  })

  const resetFilters = useHistoryViewStore((state) => {
    return state.resetFilters
  })

  const [query, setQuery] = useState(filters.q ?? '')

  const commitQuery = useMemo(() => {
    return debounce((value: string) => {
      const trimmed = value.trim()
      const q = trimmed === '' ? undefined : trimmed

      setFilters({ q })
    }, 250)
  }, [setFilters])

  useEffect(() => {
    return () => {
      commitQuery.cancel()
    }
  }, [commitQuery])

  const handleReset = () => {
    commitQuery.cancel()
    setQuery('')
    resetFilters()
  }

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value)
    commitQuery(event.target.value)
  }

  return (
    <>
      <SearchInput
        id="history-filter-search"
        name="q"
        aria-label="Search prompts"
        value={query}
        onChange={handleQueryChange}
        placeholder="Search prompt"
      />
      <FavoriteToggle />
      <FilterChoices />
      <div className="flex justify-end border-t border-divider pt-2">
        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-fg-2 transition hover:text-fg"
        >
          Reset
        </button>
      </div>
    </>
  )
}
