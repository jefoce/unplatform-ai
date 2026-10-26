'use client'

import { uniq } from 'lodash-es'

import { MODEL_PRESETS } from '@/core/presets'
import { RESOLUTIONS } from '@/core/presets/types'
import type {
  AspectFilter,
  AudioFilter,
  HistoryMode,
  ResolutionFilter,
  StatusFilter,
} from '@/core/types'

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

const RESOLUTION_OPTIONS: readonly FilterOption<ResolutionFilter>[] = [
  { value: 'all', label: 'All' },
  ...RESOLUTIONS.map((value) => {
    return { value, label: value }
  }),
]

const ASPECT_OPTIONS: readonly FilterOption<AspectFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'auto', label: 'Auto' },
  ...uniq(
    MODEL_PRESETS.flatMap((preset) => {
      return preset.aspectRatios
    }),
  ).map((value) => {
    return {
      value,
      label: value,
    }
  }),
]

const AUDIO_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
] as const

/** Status, mode, model, resolution, aspect and audio choice rows. */
export function FilterChoices() {
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
        options={[
          { value: 'all', label: 'All' },
          ...MODEL_PRESETS.map((preset) => {
            return { value: preset.id, label: preset.title }
          }),
        ]}
        onChange={handleModelChange}
      />
      <FilterChoice
        label="Resolution"
        value={filters.resolution ?? 'all'}
        options={RESOLUTION_OPTIONS}
        onChange={handleResolutionChange}
      />
      <FilterChoice
        label="Aspect"
        value={filters.aspect ?? 'all'}
        options={ASPECT_OPTIONS}
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
