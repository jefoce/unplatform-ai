'use client'

import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { debounce } from 'lodash-es'

import { SearchInput } from '@/ui/form/SearchInput'

import { FavoriteToggle } from './FavoriteToggle'
import { FilterChoices } from './FilterChoices'
import { useHistoryViewStore } from './view-store'

/** Prompt search, favorites switch, choice rows and reset. */
export function FilterForm() {
  const filters = useHistoryViewStore((state) => state.filters)
  const setFilters = useHistoryViewStore((state) => state.setFilters)
  const resetFilters = useHistoryViewStore((state) => state.resetFilters)
  const [query, setQuery] = useState(filters.q ?? '')

  const commitQuery = useMemo(
    () =>
      debounce((value: string) => {
        const trimmed = value.trim()

        setFilters({ q: trimmed === '' ? undefined : trimmed })
      }, 250),
    [setFilters],
  )

  useEffect(() => () => commitQuery.cancel(), [commitQuery])

  const handleReset = useCallback(() => {
    commitQuery.cancel()
    setQuery('')
    resetFilters()
  }, [commitQuery, resetFilters])
  const handleQueryChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setQuery(event.target.value)
      commitQuery(event.target.value)
    },
    [commitQuery],
  )

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
