'use client'

import { useState } from 'react'

import { refreshCatalog } from '@/lib/api/catalog'
import { toastError } from '@/lib/notify'

export interface CatalogRefresh {
  isFetching: boolean
  refresh: () => void
  forceRefresh: () => void
}

/** Refresh control state shared by the picker trigger and its search bar. */
export function useCatalogRefresh(): CatalogRefresh {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const run = (isForce: boolean): void => {
    setIsRefreshing(true)

    void refreshCatalog({ isForce })
      .catch((error: unknown) => {
        toastError(error, 'Could not refresh models')
      })
      .finally(() => {
        setIsRefreshing(false)
      })
  }

  const refresh = (): void => {
    run(false)
  }

  const forceRefresh = (): void => {
    run(true)
  }

  return { isFetching: isRefreshing, refresh, forceRefresh }
}
