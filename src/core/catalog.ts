import type { ImagePreset } from './presets/image/types'
import type { VideoPreset } from './presets/video/types'
import type { PricingInfo } from './pricing/types'
import type { ProviderKindId } from './providers/types'

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
