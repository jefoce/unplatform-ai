import { z } from 'zod'

import { IMAGE_COUNT_MAX, SEED_MAX } from '../constants'
import {
  IMAGE_ASPECT_RATIOS,
  IMAGE_BACKGROUNDS,
  IMAGE_QUALITIES,
  IMAGE_RESOLUTIONS,
} from '../presets/image/types'
import { PRICE_UNITS } from '../pricing/types'
import { PROVIDER_IDS } from '../providers/types'
import {
  InputSnapshotSchema,
  PRICE_SOURCES,
  RecordPresetSchema,
  RecordSubmitSchema,
} from './generation-record'

export const IMAGE_RECORD_STATUSES = [
  'submitting',
  'saving',
  'completed',
  'partial',
  'failed',
  'cancelled',
] as const

export type ImageRecordStatus = (typeof IMAGE_RECORD_STATUSES)[number]

export const IMAGE_OUTPUT_STATUSES = ['pending', 'saved', 'failed'] as const
export type ImageOutputStatus = (typeof IMAGE_OUTPUT_STATUSES)[number]

export const IMAGE_OUTPUT_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export type ImageOutputMediaType = (typeof IMAGE_OUTPUT_MEDIA_TYPES)[number]

const ImageOutputBaseSchema = z.object({
  id: z.uuid(),
  index: z.number().int().min(0),
})

const ImagePendingOutputSchema = ImageOutputBaseSchema.extend({
  status: z.literal('pending'),
})

const ImageSavedOutputSchema = ImageOutputBaseSchema.extend({
  status: z.literal('saved'),
  file: z.string(),
  mediaType: z.enum(IMAGE_OUTPUT_MEDIA_TYPES),
  width: z.number(),
  height: z.number(),
  bytes: z.number(),
  favorite: z.boolean(),
  seed: z.number().nullable().default(null),
})

export type ImageSavedOutput = z.infer<typeof ImageSavedOutputSchema>

const ImageFailedOutputSchema = ImageOutputBaseSchema.extend({
  status: z.literal('failed'),
  error: z.string(),
  errorStatus: z.number().optional(),
})

const ImageOutputSchema = z.discriminatedUnion('status', [
  ImagePendingOutputSchema,
  ImageSavedOutputSchema,
  ImageFailedOutputSchema,
])

export type ImageOutput = z.infer<typeof ImageOutputSchema>

export const ImageInputSchema = z.object({
  presetId: z.string().min(1),
  prompt: z.string(),
  count: z.number().int().min(1).max(IMAGE_COUNT_MAX),
  aspectRatio: z.enum([...IMAGE_ASPECT_RATIOS, 'auto']),
  resolution: z.enum(IMAGE_RESOLUTIONS).nullable(),
  quality: z.enum(IMAGE_QUALITIES).nullable(),
  background: z.enum(IMAGE_BACKGROUNDS).nullable(),
  references: z.array(z.string()),
  seed: z.number().int().min(0).max(SEED_MAX).nullable(),
})

export type ImageGenerationInput = z.infer<typeof ImageInputSchema>

const ImageCostSchema = z.object({
  currency: z.literal('USD'),
  unit: z.enum(PRICE_UNITS),
  estimatedUsd: z.number(),
  actualUsd: z.number().nullable(),
  priceSource: z.enum(PRICE_SOURCES),
  billed: z.boolean().nullable(),

  /** True when an uncertain call may have reached the provider. */
  mayHaveBeenCharged: z.boolean().optional(),
})

export type ImageCost = z.infer<typeof ImageCostSchema>

/** One image generation stored in `images/<uuid>.json`. */
export const ImageRecordSchema = z.object({
  id: z.uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.enum(IMAGE_RECORD_STATUSES),
  provider: z.enum(PROVIDER_IDS).default('openrouter'),
  preset: RecordPresetSchema,
  input: ImageInputSchema,
  inputsSnapshot: InputSnapshotSchema.optional(),
  submit: RecordSubmitSchema.optional(),
  outputs: z.array(ImageOutputSchema),
  seedUsed: z.number().nullable(),

  /** True when the requested seed is kept on regenerate. */
  seedLocked: z.boolean().optional(),
  cost: ImageCostSchema,
  error: z.string().optional(),
  errorStatus: z.number().optional(),
})

export type ImageRecord = z.infer<typeof ImageRecordSchema>

/** True while a record still runs and cannot be deleted. */
export function isImageActive(record: ImageRecord): boolean {
  return record.status === 'submitting' || record.status === 'saving'
}
