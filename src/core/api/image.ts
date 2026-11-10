import { omit } from 'lodash-es'
import { z } from 'zod'

import {
  HISTORY_BATCH_MAX,
  HISTORY_MAX_PAGE_SIZE,
  HISTORY_PAGE_SIZE,
  IMAGE_REFERENCE_MAX,
} from '../constants'
import {
  type ImageGenerationInput,
  ImageInputSchema,
  type ImageRecord,
} from '../schemas/image-record'

export const ImageListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(HISTORY_MAX_PAGE_SIZE).catch(HISTORY_PAGE_SIZE),
  favorite: z.enum(['1', 'true']).optional(),
  q: z.string().optional(),
  presetId: z.string().optional(),
  ids: z.string().optional(),
  active: z.enum(['1', 'true']).optional(),
})

export type ImageListQuery = z.infer<typeof ImageListQuerySchema>

export interface ImageListResult {
  items: ImageRecord[]
  nextCursor: string | null
  activeCount: number
}

/** Per-output PATCH body. */
export const ImageFavoriteSchema = z.object({ favorite: z.boolean() })
export type ImageFavoriteBody = z.infer<typeof ImageFavoriteSchema>

/** One output addressed by its record, so the server never scans every record. */
export const ImageOutputRefSchema = z.object({
  recordId: z.uuid(),
  outputId: z.uuid().nullable(),
})

export type ImageOutputRef = z.infer<typeof ImageOutputRefSchema>

export const ImageBatchSchema = z.object({
  action: z.enum(['favorite', 'delete']),
  outputs: z.array(ImageOutputRefSchema).min(1).max(HISTORY_BATCH_MAX),
  favorite: z.boolean().optional(),
})

export type ImageBatchBody = z.infer<typeof ImageBatchSchema>

export const ImageSubmitSchema = ImageInputSchema.extend({
  prompt: z.string(),
  references: z.array(z.uuid()).max(IMAGE_REFERENCE_MAX),
}).strict()

export type ImageSubmitBody = z.infer<typeof ImageSubmitSchema>

export const ImageEstimateSchema = ImageSubmitSchema.omit({ prompt: true, seed: true })
  .extend({ promptChars: z.number().int().min(0) })
  // The estimate stays tolerant: only the submit boundary rejects extra fields.
  .strip()

export type ImageEstimateBody = z.infer<typeof ImageEstimateSchema>

/** Estimate request body: every billed input field, the prompt as a length. */
export function imageEstimateBody(input: ImageGenerationInput): ImageEstimateBody {
  return { ...omit(input, ['prompt', 'seed']), promptChars: input.prompt.length }
}
