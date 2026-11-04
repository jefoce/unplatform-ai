'use client'

import { z } from 'zod'

import { createViewStore } from '@/lib/create-view-store'

export const IMAGE_VIEWS = ['grid', 'masonry'] as const

type ImageView = (typeof IMAGE_VIEWS)[number]

const ImageFiltersSchema = z.object({
  favorite: z.boolean().optional(),
  q: z.string().optional(),
  presetId: z.string().optional(),
})

export type ImageFilters = z.infer<typeof ImageFiltersSchema>

export function countImageFilters(filters: ImageFilters): number {
  const favorite = Number(filters.favorite === true)
  const query = Number(Boolean(filters.q?.trim()))
  const preset = Number(Boolean(filters.presetId))

  return favorite + query + preset
}

export const useImageViewStore = createViewStore<ImageFilters, ImageView>({
  name: 'unplatform-ai:image-view',
  version: 1,
  views: IMAGE_VIEWS,
  initialView: 'masonry',
  defaultFilters: {},
  filtersSchema: ImageFiltersSchema,
})
