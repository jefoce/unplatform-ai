import 'server-only'

import { isNil, isUndefined, keyBy } from 'lodash-es'

import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'

import { removeEndpointModelCache } from './endpoint-model-cache'

interface EndpointCacheEntry {
  id?: string
  baseUrl: string
  enabled: boolean
}

interface EndpointCacheInput {
  entry: EndpointCacheEntry
  token: string | null | undefined
}

interface PruneEndpointCachesParams {
  current: readonly CustomEndpoint[]
  prepared: readonly EndpointCacheInput[]
  removedIds: readonly string[]
}

/** Keeps caches for unchanged endpoints. Drops them for new, edited or deleted ones. */
export async function pruneEndpointCaches(params: PruneEndpointCachesParams): Promise<void> {
  const { current, prepared, removedIds } = params
  const currentById = keyBy(current, 'id')

  const staleIds = prepared
    .filter((item) => {
      const previous = currentById[item.entry.id ?? '']

      return (
        isNil(previous) ||
        previous.baseUrl !== item.entry.baseUrl ||
        previous.enabled !== item.entry.enabled ||
        !isUndefined(item.token)
      )
    })
    .map((item) => {
      return item.entry.id ?? ''
    })

  await Promise.all([...removedIds, ...staleIds].map(removeEndpointModelCache))
}
