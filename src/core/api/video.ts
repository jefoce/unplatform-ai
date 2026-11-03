import { z } from 'zod'

import { HISTORY_BATCH_MAX } from '../constants'
import type { GenerationRecord, PriceSource } from '../schemas/generation-record'

/** One id a batch route could not act on, with the reason. */
export interface BatchSkip {
  id: string
  reason: 'not_found' | 'active' | 'not_ready'
}

export interface BatchResult {
  done: string[]
  skipped: BatchSkip[]
}

const BatchIdsSchema = z.array(z.uuid()).min(1).max(HISTORY_BATCH_MAX)

const FavoriteBatchSchema = z.object({
  action: z.literal('favorite'),
  ids: BatchIdsSchema,
  favorite: z.boolean(),
})

const DeleteBatchSchema = z.object({
  action: z.literal('delete'),
  ids: BatchIdsSchema,
  favorite: z.boolean().optional(),
})

export const GenerationBatchSchema = z.discriminatedUnion('action', [
  FavoriteBatchSchema,
  DeleteBatchSchema,
])

export type GenerationBatch = z.infer<typeof GenerationBatchSchema>

export type GenerationBatchBody =
  Omit<z.infer<typeof FavoriteBatchSchema>, 'ids'> | Omit<z.infer<typeof DeleteBatchSchema>, 'ids'>

export interface GenerationListResult {
  items: GenerationRecord[]
  nextCursor: string | null
  activeCount: number
}

/** Server price for one draft, discounted and at list. Null when no quote exists. */
export interface GenerationEstimate {
  estimatedUsd: number | null
  listUsd: number | null
  pricePerSec: number | null
  priceSource: PriceSource
  discount: number
  referenceSeconds: number
}
