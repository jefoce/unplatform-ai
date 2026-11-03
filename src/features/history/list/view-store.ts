'use client'

import { clamp, isNil } from 'lodash-es'
import { z } from 'zod'

import { ZOOM_MAX, ZOOM_MIN } from '@/core/constants'
import { DEFAULT_FILTERS, FILTER_PARAMS } from '@/core/feed/history-filters'
import { ASPECT_RATIOS, RESOLUTIONS } from '@/core/presets/video/types'
import { GENERATOR_TABS } from '@/core/schemas/generation-record'
import { AUDIO_FILTERS, HISTORY_MODES, type HistoryFilters, STATUS_FILTERS } from '@/core/types'
import { createViewStore } from '@/lib/create-view-store'

export const HISTORY_VIEWS = ['list', 'grid', 'masonry'] as const

export type HistoryView = (typeof HISTORY_VIEWS)[number]

const PersistedFiltersSchema = z.object({
  q: z.string().optional(),
  model: z.string().optional(),
  favorite: z.boolean().optional(),
  status: z.enum(STATUS_FILTERS).optional(),
  tab: z.enum([...GENERATOR_TABS, 'all']).optional(),
  mode: z.enum(HISTORY_MODES).optional(),
  resolution: z.enum([...RESOLUTIONS, 'all']).optional(),
  aspect: z.enum([...ASPECT_RATIOS, 'all']).optional(),
  audio: z.enum(AUDIO_FILTERS).optional(),
})

/** Reference width the supplied slider sizes were measured at (video + details + gap). */
const REFERENCE_ROW_WIDTH = 1518

const LIST_VIDEO_WIDTHS = [604, 710, 830, 980, 1132, 1270] as const

const GRID_COLUMNS = [8, 7, 6, 5, 4, 3] as const

const TILE_WIDTHS = [172, 200, 252, 286, 362, 486] as const

const zoomStep = (zoom: number): number => {
  return clamp(Math.round(zoom), ZOOM_MIN, ZOOM_MAX)
}

/** Table value at a clamped zoom step. The ranges below cover every step. */
function stepValue<T>(values: readonly T[], zoom: number): T {
  const value = values.at(zoomStep(zoom))

  if (isNil(value)) {
    throw new Error(`Unknown zoom step: ${zoom}`)
  }

  return value
}

/** Video width as a share of the list row at each zoom step. */
export const listVideoShare = (zoom: number): number => {
  return stepValue(LIST_VIDEO_WIDTHS, zoom) / REFERENCE_ROW_WIDTH
}

/** Fixed grid columns per step: 8 at zoom 0 down to 3 at max. */
export const zoomToGridColumns = (zoom: number): number => {
  return stepValue(GRID_COLUMNS, zoom)
}

/** Tile width from the design table, measured at the 1518px reference row. */
export const zoomToTileWidth = (zoom: number): number => {
  return stepValue(TILE_WIDTHS, zoom)
}

export function countActiveFilters(filters: HistoryFilters): number {
  const active = FILTER_PARAMS.filter(([key, fallback]) => {
    const value = filters[key]

    return Boolean(value) && value !== fallback
  })

  const favorites = filters.favorite === true ? 1 : 0
  const isQuery = Boolean(filters.q?.trim())

  const query = isQuery ? 1 : 0

  return active.length + favorites + query
}

export const useHistoryViewStore = createViewStore<HistoryFilters, HistoryView>({
  name: 'unplatform-ai:view',
  version: 1,
  views: HISTORY_VIEWS,
  initialView: 'list',
  defaultFilters: DEFAULT_FILTERS,
  filtersSchema: PersistedFiltersSchema,
})
