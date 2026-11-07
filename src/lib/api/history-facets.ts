'use client'

import useSWR from 'swr'

import type { HistoryFacetKind, HistoryFacets } from '@/core/history-facets'
import { HISTORY_FACETS_PATH } from '@/lib/api/swr-keys'
import { fetcher } from '@/lib/fetcher'

import { withQuery } from './query'

interface FacetsState {
  facets: HistoryFacets | undefined
  isLoading: boolean
}

/** SWR key for one facet kind. */
function historyFacetsKey(kind: HistoryFacetKind): string {
  return withQuery(HISTORY_FACETS_PATH, { kind })
}

/** Video or image filter facets, built by the server from the stored records. */
export function useHistoryFacets(kind: HistoryFacetKind): FacetsState {
  const key = historyFacetsKey(kind)

  const { data, isLoading } = useSWR<HistoryFacets>(key, fetcher, {
    revalidateOnFocus: false,
  })

  return { facets: data, isLoading }
}
