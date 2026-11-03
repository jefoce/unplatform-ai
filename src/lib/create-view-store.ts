'use client'

import { clamp } from 'lodash-es'
import { z } from 'zod'
import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { persist } from 'zustand/middleware'

import { ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN } from '@/core/constants'

export interface ViewStoreState<TFilters, TView extends string> {
  view: TView
  zoom: number
  filters: TFilters
  setView: (view: TView) => void
  setZoom: (zoom: number) => void
  setFilters: (patch: Partial<TFilters>) => void
  resetFilters: () => void
}

interface ViewStoreConfig<TFilters, TView extends string> {
  name: string
  version: number
  views: readonly [TView, ...TView[]]
  initialView: TView
  defaultFilters: TFilters
  filtersSchema: z.ZodType<TFilters>
}

/** Persisted view, zoom and filters store shared by the video and image feeds. */
export function createViewStore<TFilters extends object, TView extends string>(
  config: ViewStoreConfig<TFilters, TView>,
): UseBoundStore<StoreApi<ViewStoreState<TFilters, TView>>> {
  const { name, version, views, initialView, defaultFilters, filtersSchema } = config

  const persistedSchema = z.object({
    view: z.enum(views).optional().catch(undefined),
    zoom: z.number().int().min(ZOOM_MIN).max(ZOOM_MAX).optional().catch(undefined),
    filters: filtersSchema.optional().catch(undefined),
  })

  return create<ViewStoreState<TFilters, TView>>()(
    persist(
      (set) => {
        return {
          view: initialView,
          zoom: ZOOM_DEFAULT,
          filters: { ...defaultFilters },
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
            set({ filters: { ...defaultFilters } })
          },
        }
      },
      {
        name,
        version,
        partialize: (state) => {
          return { view: state.view, zoom: state.zoom, filters: state.filters }
        },
        migrate: (persisted) => {
          return persisted
        },
        merge: (persisted, current) => {
          const parsed = persistedSchema.safeParse(persisted)

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
}
