'use client'

import { isNil } from 'lodash-es'
import useSWR, { mutate } from 'swr'

import type { CatalogEntry, ModelCatalog } from '@/core/catalog'
import { setRuntimeVideoPresets } from '@/core/presets'
import { isVideoPreset } from '@/core/presets/common/preset-kind'
import { setRuntimeImagePresets } from '@/core/presets/image'
import type { ImagePreset } from '@/core/presets/image/types'
import type { VideoPreset } from '@/core/presets/video/types'
import { fetcher } from '@/lib/fetcher'

import { MODELS_KEY } from './swr-keys'

interface RuntimeSplit {
  video: VideoPreset[]
  image: ImagePreset[]
}

function splitPresets(entries: readonly CatalogEntry[]): RuntimeSplit {
  const split: RuntimeSplit = { video: [], image: [] }

  for (const entry of entries) {
    const preset = entry.preset

    if (isNil(preset)) {
      continue
    }

    if (isVideoPreset(preset)) {
      split.video.push(preset)

      continue
    }

    split.image.push(preset)
  }

  return split
}

/** Publishes catalog presets so the shared find helpers see dynamic models. */
export function registerCatalogPresets(entries: readonly CatalogEntry[]): void {
  const split = splitPresets(entries)

  setRuntimeVideoPresets(split.video)
  setRuntimeImagePresets(split.image)
}

async function fetchCatalog(): Promise<ModelCatalog> {
  const catalog = await fetcher<ModelCatalog>(MODELS_KEY)

  registerCatalogPresets(catalog.entries)

  return catalog
}

export interface CatalogState {
  catalog: ModelCatalog | undefined
  isLoading: boolean
  isValidating: boolean
}

/** Shared catalog read used by the picker groups and the refresh control. */
export function useCatalog(): CatalogState {
  const { data, isLoading, isValidating } = useSWR<ModelCatalog>(MODELS_KEY, fetchCatalog, {
    revalidateOnFocus: false,
  })

  return { catalog: data, isLoading, isValidating }
}

/** Refetches the catalog, resolving once the new entries are registered. */
export async function refreshCatalog(): Promise<void> {
  await mutate(MODELS_KEY)
}
