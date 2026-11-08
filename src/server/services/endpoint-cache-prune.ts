import 'server-only'

import { isNil, isUndefined, keyBy } from 'lodash-es'

import type { CustomEndpoint, CustomEndpointLastHealth } from '@/core/schemas/custom-endpoint'

import { isFreshTest } from './endpoint-health'
import { removeEndpointModelCache } from './endpoint-model-cache'

interface EndpointCacheEntry {
  id?: string
  baseUrl: string
  enabled: boolean
  lastHealth: CustomEndpointLastHealth | null
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

      if (isNil(previous)) {
        return false
      }

      const isLocationChange = previous.baseUrl !== item.entry.baseUrl || !isUndefined(item.token)

      if (isLocationChange) {
        return true
      }

      return previous.enabled !== item.entry.enabled && !isFreshTest({ previous, item })
    })
    .map((item) => {
      return item.entry.id ?? ''
    })

  await Promise.all([...removedIds, ...staleIds].map(removeEndpointModelCache))
}
