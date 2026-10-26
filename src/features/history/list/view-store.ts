'use client'

import { clamp, isNil } from 'lodash-es'
import { z } from 'zod'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN } from '@/core/constants'
import { DEFAULT_FILTERS, FILTER_PARAMS } from '@/core/history-filters'
import { ASPECT_RATIOS, RESOLUTIONS } from '@/core/presets/types'
import { GENERATOR_TABS } from '@/core/schemas/generation-record'
import {
  AUDIO_FILTERS,
  HISTORY_MODES,
  type HistoryFilters,
  type HistoryMode,
  STATUS_FILTERS,
} from '@/core/types'

export const HISTORY_VIEWS = ['list', 'grid'] as const

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

const PersistedViewSchema = z.object({
  view: z.enum(HISTORY_VIEWS).optional().catch(undefined),
  zoom: z.number().int().min(ZOOM_MIN).max(ZOOM_MAX).optional().catch(undefined),
  filters: PersistedFiltersSchema.optional().catch(undefined),
})

interface ViewFilters extends HistoryFilters {
  mode?: HistoryMode
}

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

export function countActiveFilters(filters: ViewFilters): number {
  const active = FILTER_PARAMS.filter(([key, fallback]) => {
    const value = filters[key]

    return Boolean(value) && value !== fallback
  })

  const favorites = filters.favorite === true ? 1 : 0
  const isQuery = Boolean(filters.q?.trim())

  const query = isQuery ? 1 : 0

  return active.length + favorites + query
}

interface ViewState {
  view: HistoryView
  zoom: number
  filters: ViewFilters
  setView: (view: HistoryView) => void
  setZoom: (zoom: number) => void
  setFilters: (patch: Partial<ViewFilters>) => void
  resetFilters: () => void
}

export const useHistoryViewStore = create<ViewState>()(
  persist(
    (set) => {
      return {
        view: 'list',
        zoom: ZOOM_DEFAULT,
        filters: { ...DEFAULT_FILTERS },
        setView: (view) => {
          set({ view })
        },
        setZoom: (zoom) => {
          set({ zoom: clamp(Math.round(zoom), ZOOM_MIN, ZOOM_MAX) })
        },
        setFilters: (patch) => {
          set((state) => {
            return { filters: { ...state.filters, ...patch } }
          })
        },
        resetFilters: () => {
          set({ filters: { ...DEFAULT_FILTERS } })
        },
      }
    },
    {
      name: 'unplatform-ai:view',
      version: 1,
      partialize: (state) => {
        return { view: state.view, zoom: state.zoom, filters: state.filters }
      },
      migrate: (persisted) => {
        return persisted
      },
      merge: (persisted, current) => {
        const parsed = PersistedViewSchema.safeParse(persisted)

        if (!parsed.success) {
          return current
        }

        const { view, zoom, filters } = parsed.data

        return {
          ...current,
          view: view ?? current.view,
          zoom: zoom ?? current.zoom,
          filters: { ...current.filters, ...filters },
        }
      },
    },
  ),
)
