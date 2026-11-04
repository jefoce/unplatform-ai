import type { PricingInfo } from './pricing/types'
import type { ProviderId } from './providers/types'

export const MODEL_STATUSES = ['available', 'unverified', 'missing', 'no_provider'] as const

export type ModelStatus = (typeof MODEL_STATUSES)[number]

export interface CatalogEntry {
  modelId: string
  presetId: string
  provider: ProviderId | null
  status: ModelStatus
  reason: string | null
  pricing: PricingInfo | null
}

export interface ModelCatalog {
  entries: readonly CatalogEntry[]
  fetchedAt: string
}
