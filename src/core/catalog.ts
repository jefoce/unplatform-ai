import type { PricingInfo } from './pricing/types'
import type { ProviderKindId } from './providers/types'

export const MODEL_STATUSES = ['available', 'unverified', 'missing', 'no_provider'] as const

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
}

export interface CatalogEntry {
  modelId: string
  presetId: string
  provider: ProviderKindId | null
  status: ModelStatus
  reason: string | null
  pricing: PricingInfo | null
  availability: ModelAvailability
  source: CatalogEntrySource
}

export interface ModelCatalog {
  entries: readonly CatalogEntry[]
  fetchedAt: string
}
