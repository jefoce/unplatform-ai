import { isNil } from 'lodash-es'

import type { ImagePreset } from './presets/image/types'
import type { VideoPreset } from './presets/video/types'
import type { PricingInfo } from './pricing/types'
import { CUSTOM_MISSING_MESSAGE, CUSTOM_STALE_MESSAGE } from './providers/custom-messages'
import type { ProviderKindId } from './providers/types'

export const CATALOG_UNREACHABLE_REASON = 'ComfyUI is not reachable.'
export const CATALOG_MISSING_REASON = CUSTOM_MISSING_MESSAGE
export const CATALOG_STALE_REASON = CUSTOM_STALE_MESSAGE

export const MODEL_STATUSES = [
  'available',
  'unverified',
  'missing',
  'invalid',
  'no_provider',
] as const

export type ModelStatus = (typeof MODEL_STATUSES)[number]

export interface ModelAvailability {
  status: ModelStatus
  reason: string | null
}

export interface CatalogEntrySource {
  kind: ProviderKindId
  instanceId: string
  badge: string | null
  workflowName: string | null
  local: boolean

  /** Price suffix for the picker. Static presets leave it unset. */
  priceUnit?: 'run' | 'second'
}

export interface CatalogEntry {
  modelId: string
  presetId: string
  provider: ProviderKindId | null
  status: ModelStatus
  reason: string | null
  pricing: PricingInfo | null
  source: CatalogEntrySource

  /** Runtime preset for dynamic models, absent for the static ones. */
  preset?: VideoPreset | ImagePreset
}

export interface ModelCatalog {
  entries: readonly CatalogEntry[]
  fetchedAt: string
}

/** Reason for an existing entry. Null when it is ready. */
export function catalogEntryReason(entry: CatalogEntry): string | null {
  if (entry.status === 'unverified') {
    return entry.reason ?? CATALOG_UNREACHABLE_REASON
  }

  if (entry.status === 'missing' || entry.status === 'no_provider' || entry.status === 'invalid') {
    return entry.reason ?? CATALOG_MISSING_REASON
  }

  if (!isNil(entry.reason)) {
    return CATALOG_STALE_REASON
  }

  return null
}
