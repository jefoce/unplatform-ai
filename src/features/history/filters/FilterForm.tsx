'use client'

import { type ChangeEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import { debounce } from 'lodash-es'

import { SearchInput } from '@/ui/form/SearchInput'
import { Switch } from '@/ui/form/Switch'

interface FilterValues {
  q?: string
  favorite?: boolean
}

interface FilterFormProps {
  filters: FilterValues
  setFilters: (patch: FilterValues) => void
  resetFilters: () => void
  favoriteLabel: string
  children: ReactNode
}

/** Prompt search, liked switch, choice rows and reset, shared by both feeds. */
export function FilterForm(props: FilterFormProps) {
  const { filters, setFilters, resetFilters, favoriteLabel } = props
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
      commitQuery.flush()
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

  const handleFavoriteChange = (isChecked: boolean) => {
    const isFavorite = isChecked ? true : undefined

    setFilters({ favorite: isFavorite })
  }

  return (
    <>
      <SearchInput
        id="filter-search"
        name="q"
        aria-label="Search prompts"
        value={query}
        onChange={handleQueryChange}
        placeholder="Search prompt"
      />
      <Switch
        checked={filters.favorite === true}
        onCheckedChange={handleFavoriteChange}
        label={favoriteLabel}
      />
      {props.children}
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
