'use client'

import { useCallback } from 'react'
import { uniq } from 'lodash-es'

import { type AspectChoice, MODEL_PRESETS, type Resolution, RESOLUTIONS } from '@/core/presets'

import { FilterChoice } from './FilterChoice'
import { type HistoryMode, useHistoryViewStore, type ViewFilters } from './view-store'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'done', label: 'Done' },
  { value: 'active', label: 'In progress' },
  { value: 'failed', label: 'Failed' },
] as const

const MODE_OPTIONS: readonly { value: HistoryMode; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'text', label: 'Text' },
  { value: 'frames', label: 'Frames' },
  { value: 'references', label: 'References' },
]

const RESOLUTION_OPTIONS: readonly { value: Resolution | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  ...RESOLUTIONS.map((value) => ({ value, label: value })),
]

const ASPECT_OPTIONS: readonly { value: AspectChoice | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'auto', label: 'Auto' },
  ...uniq(MODEL_PRESETS.flatMap((preset) => preset.aspectRatios)).map((value) => ({
    value,
    label: value,
  })),
]

const AUDIO_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
] as const

/** Status, mode, model, resolution, aspect and audio choice rows. */
export function FilterChoices() {
  const filters = useHistoryViewStore((state) => state.filters)
  const setFilters = useHistoryViewStore((state) => state.setFilters)

  const handleStatusChange = useCallback(
    (status: NonNullable<ViewFilters['status']>) => setFilters({ status }),
    [setFilters],
  )
  const handleModeChange = useCallback(
    (mode: NonNullable<ViewFilters['mode']>) =>
      setFilters({ mode, tab: mode === 'frames' || mode === 'references' ? mode : 'all' }),
    [setFilters],
  )
  const handleModelChange = useCallback(
    (model: NonNullable<ViewFilters['model']>) => setFilters({ model }),
    [setFilters],
  )
  const handleResolutionChange = useCallback(
    (resolution: NonNullable<ViewFilters['resolution']>) => setFilters({ resolution }),
    [setFilters],
  )
  const handleAspectChange = useCallback(
    (aspect: NonNullable<ViewFilters['aspect']>) => setFilters({ aspect }),
    [setFilters],
  )
  const handleAudioChange = useCallback(
    (audio: NonNullable<ViewFilters['audio']>) => setFilters({ audio }),
    [setFilters],
  )

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
          ...MODEL_PRESETS.map((preset) => ({ value: preset.id, label: preset.title })),
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
