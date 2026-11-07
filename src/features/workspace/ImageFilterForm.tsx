'use client'

import { isNil } from 'lodash-es'

import type { ModelFacet } from '@/core/history-facets'
import { IMAGE_PRESETS } from '@/core/presets/image'
import { FilterChoice, type FilterOption } from '@/features/history/filters/FilterChoice'
import { FilterForm } from '@/features/history/filters/FilterForm'
import { useHistoryFacets } from '@/lib/api/history-facets'

import { useImageViewStore } from './image-view-store'

function modelLabel(facet: ModelFacet): string {
  let badge = ''

  if (!isNil(facet.badge)) {
    badge = `[${facet.badge}] `
  }

  return `${badge}${facet.title} (${facet.count})`
}

function modelOptions(models: readonly ModelFacet[] | undefined): FilterOption<string>[] {
  if (isNil(models) || models.length === 0) {
    return [
      { value: 'all', label: 'All' },
      ...IMAGE_PRESETS.map((preset) => {
        return { value: preset.id, label: preset.title }
      }),
    ]
  }

  return [
    { value: 'all', label: 'All' },
    ...models.map((facet) => {
      return { value: facet.presetId, label: modelLabel(facet) }
    }),
  ]
}

/** Image filter fields, bound to the image view store. */
export function ImageFilterForm() {
  const { facets } = useHistoryFacets('image')

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
        options={modelOptions(facets?.models)}
        onChange={handlePresetChange}
      />
    </FilterForm>
  )
}
