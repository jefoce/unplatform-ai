'use client'

import { IMAGE_PRESETS } from '@/core/presets/image'
import { FilterChoice } from '@/features/history/filters/FilterChoice'
import { FilterForm } from '@/features/history/filters/FilterForm'

import { useImageViewStore } from './image-view-store'

const PRESET_OPTIONS = [
  { value: 'all', label: 'All' },
  ...IMAGE_PRESETS.map((preset) => {
    return { value: preset.id, label: preset.title }
  }),
]

/** Image filter fields, bound to the image view store. */
export function ImageFilterForm() {
  const filters = useImageViewStore((state) => {
    return state.filters
  })

  const setFilters = useImageViewStore((state) => {
    return state.setFilters
  })

  const resetFilters = useImageViewStore((state) => {
    return state.resetFilters
  })

  const handlePresetChange = (value: string) => {
    const presetId = value === 'all' ? undefined : value

    setFilters({ presetId })
  }

  return (
    <FilterForm
      filters={filters}
      setFilters={setFilters}
      resetFilters={resetFilters}
      favoriteLabel="Liked only"
    >
      <FilterChoice
        label="Preset"
        value={filters.presetId ?? 'all'}
        options={PRESET_OPTIONS}
        onChange={handlePresetChange}
      />
    </FilterForm>
  )
}
