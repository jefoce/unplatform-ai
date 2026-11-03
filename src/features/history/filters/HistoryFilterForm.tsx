'use client'

import { useHistoryViewStore } from '../list/view-store'
import { FilterChoices } from './FilterChoices'
import { FilterForm } from './FilterForm'

/** Video feed filters, bound to the history view store. */
export function HistoryFilterForm() {
  const filters = useHistoryViewStore((state) => {
    return state.filters
  })

  const setFilters = useHistoryViewStore((state) => {
    return state.setFilters
  })

  const resetFilters = useHistoryViewStore((state) => {
    return state.resetFilters
  })

  return (
    <FilterForm
      filters={filters}
      setFilters={setFilters}
      resetFilters={resetFilters}
      favoriteLabel="Liked only"
    >
      <FilterChoices />
    </FilterForm>
  )
}
