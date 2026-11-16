'use client'

import { isNil } from 'lodash-es'

import type { EndpointOverviewEntry } from '@/core/api/endpoints'
import { CATALOG_MISSING_REASON, type CatalogEntry, catalogEntryReason } from '@/core/catalog'
import type { HistoryFacetKind } from '@/core/history-facets'
import { isCustomPresetId } from '@/core/presets/custom'
import { useSecrets } from '@/features/settings/use-secrets'
import { useEndpointsSnapshot } from '@/features/shared/endpoints-status-context'
import { useCatalog } from '@/lib/api/catalog'
import { useCredits } from '@/lib/api/credits'
import { endpointById, hasReadyEndpoint } from '@/lib/api/endpoints-status'

const PROVIDER_KEY_REASON = 'Add your OpenRouter key in Settings.'

export interface ProviderReady {
  isEndpointChecking: boolean
  isKeyMissing: boolean
  isReady: boolean
  reason: string | null
}

/** Model-specific reason first: unreachable, missing, stale, then the key. */
function modelReason(entry: CatalogEntry | null): string | null {
  if (isNil(entry)) {
    return null
  }

  return catalogEntryReason(entry)
}

interface ReasonParams {
  entry: CatalogEntry | null
  isKeyMissing: boolean
  isCustomId: boolean
  isCatalogLoading: boolean
}

function readyReason(params: ReasonParams): string | null {
  const { entry, isKeyMissing, isCustomId, isCatalogLoading } = params
  const model = modelReason(entry)
  const isOpenRouter = !isCustomId && (isNil(entry) || entry.source.kind === 'openrouter')

  if (!isNil(model)) {
    return model
  }

  if (isCustomId && isNil(entry) && !isCatalogLoading) {
    return CATALOG_MISSING_REASON
  }

  if (isOpenRouter && isKeyMissing) {
    return PROVIDER_KEY_REASON
  }

  return null
}

/** True while the selected custom endpoint is still in its boot probe. */
function isSelectedEndpointChecking(
  entry: CatalogEntry | null,
  endpoints: readonly EndpointOverviewEntry[],
): boolean {
  if (isNil(entry)) {
    return false
  }

  return endpointById(endpoints, entry.source.instanceId)?.status === 'checking'
}

/** Ready gate: an OpenRouter key or one healthy custom endpoint for the tab kind. */
export function useProviderReady(
  presetId?: string,
  kind: HistoryFacetKind = 'video',
): ProviderReady {
  const { status } = useSecrets()
  const { credits } = useCredits()
  const { endpoints } = useEndpointsSnapshot()
  const { catalog, isLoading } = useCatalog()

  const entry =
    catalog?.entries.find((item) => {
      return item.presetId === presetId
    }) ?? null

  const isMock = credits?.source === 'mock'
  const isKeyMissing = !isNil(status) && !status.keys.OPENROUTER_API_KEY.set && !isMock
  const isCustomReady = hasReadyEndpoint(endpoints, kind)
  const isReady = !isKeyMissing || isCustomReady
  const isCustomId = !isNil(presetId) && isCustomPresetId(presetId)
  const isEndpointChecking = isSelectedEndpointChecking(entry, endpoints)

  const reason = readyReason({
    entry,
    isKeyMissing,
    isCustomId,
    isCatalogLoading: isLoading,
  })

  return { isEndpointChecking, isKeyMissing, isReady: isReady && isNil(reason), reason }
}
