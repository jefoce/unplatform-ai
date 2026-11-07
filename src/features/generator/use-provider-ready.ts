'use client'

import { isNil } from 'lodash-es'

import type { CatalogEntry } from '@/core/catalog'
import type { HistoryFacetKind } from '@/core/history-facets'
import { isCustomPresetId } from '@/core/presets/custom'
import { useSecrets } from '@/features/settings/use-secrets'
import { useModelEntry } from '@/lib/api/catalog'
import { useCredits } from '@/lib/api/credits'
import { hasReadyEndpoint, useEndpointsStatus } from '@/lib/api/endpoints-status'

const PROVIDER_KEY_REASON = 'Add your OpenRouter key in Settings.'
const UNREACHABLE_REASON = 'ComfyUI is not reachable.'
const STALE_REASON = 'Workflow changed in ComfyUI. Save it in ComfyUI, then refresh.'

export interface ProviderReady {
  isKeyMissing: boolean
  isReady: boolean
  reason: string | null
}

/** Model-specific reason first: unreachable, missing, stale, then the key. */
function modelReason(entry: CatalogEntry | null): string | null {
  if (isNil(entry)) {
    return null
  }

  if (entry.status === 'unverified') {
    return entry.reason ?? UNREACHABLE_REASON
  }

  if (entry.status === 'missing' || entry.status === 'no_provider') {
    return entry.reason ?? PROVIDER_KEY_REASON
  }

  if (entry.status === 'invalid') {
    return entry.reason
  }

  if (!isNil(entry.reason)) {
    return STALE_REASON
  }

  return null
}

interface ReasonParams {
  entry: CatalogEntry | null
  isKeyMissing: boolean
  isCustomId: boolean
}

function readyReason(params: ReasonParams): string | null {
  const { entry, isKeyMissing, isCustomId } = params
  const model = modelReason(entry)
  const isOpenRouter = !isCustomId && (isNil(entry) || entry.source.kind === 'openrouter')

  if (!isNil(model)) {
    return model
  }

  if (isOpenRouter && isKeyMissing) {
    return PROVIDER_KEY_REASON
  }

  return null
}

/** Ready gate: an OpenRouter key or one healthy custom endpoint for the tab kind. */
export function useProviderReady(
  presetId?: string,
  kind: HistoryFacetKind = 'video',
): ProviderReady {
  const { status } = useSecrets()
  const { credits } = useCredits()
  const { endpoints } = useEndpointsStatus()
  const entry = useModelEntry(presetId ?? '')
  const isMock = credits?.source === 'mock'
  const isKeyMissing = !isNil(status) && !status.keys.OPENROUTER_API_KEY.set && !isMock
  const isCustomReady = hasReadyEndpoint(endpoints, kind)
  const isReady = !isKeyMissing || isCustomReady

  const reason = readyReason({
    entry,
    isKeyMissing,
    isCustomId: !isNil(presetId) && isCustomPresetId(presetId),
  })

  return { isKeyMissing, isReady: isReady && isNil(reason), reason }
}
