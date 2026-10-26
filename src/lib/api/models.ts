'use client'

import useSWR, { mutate } from 'swr'

import type { CatalogEntry, ModelCatalog } from '@/core/catalog'
import { fetcher } from '@/lib/fetcher'
import { MODELS_KEY } from '@/lib/swr-keys'

function fetchModelCatalog(): Promise<ModelCatalog> {
  return fetcher<ModelCatalog>(MODELS_KEY)
}

interface ModelCatalogState {
  catalog: ModelCatalog | undefined
  isLoading: boolean
}

/** Runtime model catalog. Refreshed after a settings save, never polled. */
function useModelCatalog(): ModelCatalogState {
  const { data, isLoading } = useSWR<ModelCatalog>(MODELS_KEY, fetchModelCatalog, {
    revalidateOnFocus: false,
  })

  return { catalog: data, isLoading }
}

/** One preset's catalog entry, or null while loading or unknown. */
export function useModelEntry(presetId: string): CatalogEntry | null {
  const { catalog } = useModelCatalog()

  return (
    catalog?.entries.find((entry) => {
      return entry.presetId === presetId
    }) ?? null
  )
}

/** Revalidates the catalog after settings change. */
export async function refreshModels(): Promise<void> {
  await mutate(MODELS_KEY)
}
