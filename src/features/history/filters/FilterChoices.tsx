'use client'

import { isEmpty, isNil, uniq } from 'lodash-es'

import { isOneOf } from '@/core/guards'
import type { HistoryFacets, ModelFacet } from '@/core/history-facets'
import { VIDEO_PRESETS } from '@/core/presets'
import { ASPECT_RATIOS, RESOLUTIONS } from '@/core/presets/video/types'
import type {
  AspectFilter,
  AudioFilter,
  HistoryMode,
  ResolutionFilter,
  StatusFilter,
} from '@/core/types'
import { useHistoryFacets } from '@/lib/api/history-facets'

import { useHistoryViewStore } from '../list/view-store'
import { FilterChoice, type FilterOption } from './FilterChoice'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'done', label: 'Done' },
  { value: 'active', label: 'In progress' },
  { value: 'failed', label: 'Failed' },
] as const

const MODE_OPTIONS: readonly FilterOption<HistoryMode>[] = [
  { value: 'all', label: 'All' },
  { value: 'text', label: 'Text' },
  { value: 'frames', label: 'Frames' },
  { value: 'references', label: 'References' },
]

function modelLabel(facet: ModelFacet): string {
  let badge = ''

  if (!isNil(facet.badge)) {
    badge = `[${facet.badge}] `
  }

  return `${badge}${facet.title} (${facet.count})`
}

interface FacetOptionsParams {
  facets: HistoryFacets | undefined
}

function staticModelOptions(): FilterOption<string>[] {
  return [
    { value: 'all', label: 'All' },
    ...VIDEO_PRESETS.map((preset) => {
      return { value: preset.id, label: preset.title }
    }),
  ]
}

function modelOptions(params: FacetOptionsParams): FilterOption<string>[] {
  const models = params.facets?.models

  if (isNil(models) || models.length === 0) {
    return staticModelOptions()
  }

  return [
    { value: 'all', label: 'All' },
    ...models.map((facet) => {
      return { value: facet.presetId, label: modelLabel(facet) }
    }),
  ]
}

function resolutionOptions(params: FacetOptionsParams): FilterOption<ResolutionFilter>[] {
  const stored = params.facets?.resolutions
  let values: readonly string[] = stored ?? RESOLUTIONS

  if (values.length === 0) {
    values = RESOLUTIONS
  }

  const options: FilterOption<ResolutionFilter>[] = [{ value: 'all', label: 'All' }]

  for (const value of values) {
    if (isOneOf(RESOLUTIONS, value)) {
      options.push({ value, label: value })
    }
  }

  return options
}

function aspectValues(params: FacetOptionsParams): string[] {
  const facets = params.facets

  if (!isNil(facets) && !isEmpty(facets.aspects)) {
    return facets.aspects
  }

  return uniq(
    VIDEO_PRESETS.flatMap((preset) => {
      return preset.aspectRatios
    }),
  )
}

function aspectOptions(params: FacetOptionsParams): FilterOption<AspectFilter>[] {
  const options: FilterOption<AspectFilter>[] = [
    { value: 'all', label: 'All' },
    { value: 'auto', label: 'Auto' },
  ]

  for (const value of aspectValues(params)) {
    if (isOneOf(ASPECT_RATIOS, value)) {
      options.push({ value, label: value })
    }
  }

  return options
}

const AUDIO_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
] as const

/** Status, mode, model, resolution, aspect and audio choice rows. */
export function FilterChoices() {
  const { facets } = useHistoryFacets('video')

  const filters = useHistoryViewStore((state) => {
    return state.filters
  })

  const setFilters = useHistoryViewStore((state) => {
    return state.setFilters
  })

  const handleStatusChange = (status: StatusFilter) => {
    setFilters({ status })
  }

  const handleModeChange = (mode: HistoryMode) => {
    const isModeTab = mode === 'frames' || mode === 'references'
    const tab = isModeTab ? mode : 'all'

    setFilters({ mode, tab })
  }

  const handleModelChange = (model: string) => {
    setFilters({ model })
  }

  const handleResolutionChange = (resolution: ResolutionFilter) => {
    setFilters({ resolution })
  }

  const handleAspectChange = (aspect: AspectFilter) => {
    setFilters({ aspect })
  }

  const handleAudioChange = (audio: AudioFilter) => {
    setFilters({ audio })
  }

  return (
    <>
      <FilterChoice
        label="Status"
        value={filters.status ?? 'all'}
        options={STATUS_OPTIONS}
        onChange={handleStatusChange}
      />
      <FilterChoice
        label="Mode"
        value={filters.mode ?? 'all'}
        options={MODE_OPTIONS}
        onChange={handleModeChange}
      />
      <FilterChoice
        label="Model"
        value={filters.model ?? 'all'}
        options={modelOptions({ facets })}
        onChange={handleModelChange}
      />
      <FilterChoice
        label="Resolution"
        value={filters.resolution ?? 'all'}
        options={resolutionOptions({ facets })}
        onChange={handleResolutionChange}
      />
      <FilterChoice
        label="Aspect"
        value={filters.aspect ?? 'all'}
        options={aspectOptions({ facets })}
        onChange={handleAspectChange}
      />
      <FilterChoice
        label="Audio"
        value={filters.audio ?? 'any'}
        options={AUDIO_OPTIONS}
        onChange={handleAudioChange}
      />
    </>
  )
}
