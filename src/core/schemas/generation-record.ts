import { z } from 'zod'

import { FLATTEN_COLORS, IMAGE_FORMATS } from '../media-types'
import { ASPECT_RATIOS, RESOLUTIONS, RESOLVED_TRANSPORTS } from '../presets/types'
import { VIDEO_PROVIDER_IDS } from '../providers/types'
import { MediaKindSchema, UploadSourceSchema } from './upload-item'

export const GENERATOR_TABS = ['frames', 'references'] as const

const GeneratorTabSchema = z.enum(GENERATOR_TABS)

export type GeneratorTab = z.infer<typeof GeneratorTabSchema>

export const JOB_STATUSES = [
  'submitting',
  'pending',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
  'expired',
] as const

const JobStatusSchema = z.enum(JOB_STATUSES)

export type JobStatus = z.infer<typeof JobStatusSchema>

export const PRICE_SOURCES = ['live', 'fallback', 'mock', 'unknown'] as const

const PriceSourceSchema = z.enum(PRICE_SOURCES)

export type PriceSource = z.infer<typeof PriceSourceSchema>

export const FrameSlotsSchema = z.object({
  start: z.string().nullable(),
  end: z.string().nullable(),
})

const AspectChoiceSchema = z.enum([...ASPECT_RATIOS, 'auto'])
const ResolutionSchema = z.enum(RESOLUTIONS)

const GenerationInputSchema = z.object({
  presetId: z.string(),
  tab: GeneratorTabSchema,
  prompt: z.string(),
  audio: z.boolean(),
  duration: z.number(),
  aspectRatio: AspectChoiceSchema,
  resolution: ResolutionSchema,
  frames: FrameSlotsSchema,
  references: z.array(z.string()),
  seed: z.number().nullable(),
})

export type GenerationInput = z.infer<typeof GenerationInputSchema>

const RecordPresetSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
})

export type RecordPreset = z.infer<typeof RecordPresetSchema>

const RecordSubmitSchema = z.object({
  stage: z.enum(['grace', 'uploading', 'sending']),
  notBefore: z.string().optional(),
  progress: z.number().optional(),
})

export type RecordSubmit = z.infer<typeof RecordSubmitSchema>

const RecordJobSchema = z.object({
  id: z.string(),
  generationId: z.string().optional(),
  submittedAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  expiresAt: z.number().optional(),
})

export type RecordJob = z.infer<typeof RecordJobSchema>

const RecordDownloadSchema = z.object({
  startedAt: z.string(),
})

export type RecordDownload = z.infer<typeof RecordDownloadSchema>

const RecordOutputSchema = z.object({
  video: z.string(),
  preview: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  durationSec: z.number().optional(),
  bytes: z.number().optional(),
})

export type RecordOutput = z.infer<typeof RecordOutputSchema>

const SnapshotItemSchema = z.object({
  kind: MediaKindSchema,
  originalName: z.string(),
  source: UploadSourceSchema,
  target: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  transport: z.enum(RESOLVED_TRANSPORTS).optional(),
  sentWidth: z.number().optional(),
  sentHeight: z.number().optional(),
  sentBytes: z.number().optional(),
  format: z.enum(IMAGE_FORMATS).optional(),
  flattened: z.enum(FLATTEN_COLORS).optional(),
})

export type SnapshotItem = z.infer<typeof SnapshotItemSchema>

const InputSnapshotSchema = z.record(z.string(), SnapshotItemSchema)

export type InputSnapshot = z.infer<typeof InputSnapshotSchema>

const GenerationCostSchema = z.object({
  currency: z.literal('USD'),
  pricePerSec: z.number(),
  priceSource: PriceSourceSchema,
  estimatedUsd: z.number(),
  actualUsd: z.number().nullable(),
  isByok: z.boolean().nullable(),
  billed: z.boolean().nullable(),
})

export type GenerationCost = z.infer<typeof GenerationCostSchema>

/** One generation stored in `downloads/<uuid>.json`. */
export const GenerationRecordSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: JobStatusSchema,
  provider: z.enum(VIDEO_PROVIDER_IDS).default('openrouter'),
  input: GenerationInputSchema,
  preset: RecordPresetSchema,
  inputsSnapshot: InputSnapshotSchema,
  submit: RecordSubmitSchema.optional(),
  job: RecordJobSchema.optional(),
  download: RecordDownloadSchema.optional(),
  seedUsed: z.number().nullable(),
  favorite: z.boolean(),
  cost: GenerationCostSchema,
  output: RecordOutputSchema.optional(),
  error: z.string().optional(),
})

export type GenerationRecord = z.infer<typeof GenerationRecordSchema>
