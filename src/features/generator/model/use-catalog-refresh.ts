'use client'

import { useState } from 'react'

import { refreshCatalog } from '@/lib/api/catalog'

export interface CatalogRefresh {
  isFetching: boolean
  refresh: () => void
}

/** Refresh control state shared by the picker trigger and its search bar. */
export function useCatalogRefresh(): CatalogRefresh {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refresh = (): void => {
    setIsRefreshing(true)

    void refreshCatalog().finally(() => {
      setIsRefreshing(false)
    })
  }

  return { isFetching: isRefreshing, refresh }
}
