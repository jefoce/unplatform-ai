import 'server-only'

import { isNil, isUndefined, keyBy } from 'lodash-es'

import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'

import { removeEndpointModelCache } from './endpoint-model-cache'
import { lastTestFor } from './endpoint-test'
import { readEndpointToken } from './endpoint-tokens'

interface EndpointCacheEntry {
  id: string
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
      const previous = currentById[item.entry.id]

      if (isNil(previous)) {
        return false
      }

      if (previous.baseUrl !== item.entry.baseUrl || !isUndefined(item.token)) {
        return true
      }

      return previous.enabled !== item.entry.enabled && !hasServerTest(item)
    })
    .map((item) => {
      return item.entry.id
    })

  await Promise.all([...removedIds, ...staleIds].map(removeEndpointModelCache))
}

/** A test of the saved URL and token already refreshed the cache. */
function hasServerTest(item: EndpointCacheInput): boolean {
  const token = readEndpointToken(item.entry.id)

  return !isNil(lastTestFor({ baseUrl: item.entry.baseUrl, token }))
}
