import { z } from 'zod'

/** upai/1 wire schemas. Source revision lives in docs/protocol/upai-1/SOURCE. */

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const INSTANCE_ID_PATTERN =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})?$/

const MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,128}$/
const SHA256_PATTERN = /^[0-9a-f]{64}$/
const UPLOAD_REF_PATTERN = /^upai-upload:[0-9a-f]{64}$/

export const UPAI_ERROR_CODES = [
  'invalid_request',
  'unauthorized',
  'forbidden',
  'config_invalid',
  'model_not_found',
  'job_not_found',
  'upload_not_found',
  'not_found',
  'method_not_allowed',
  'too_large',
  'workflow_invalid',
  'queue_full',
  'comfy_unavailable',
  'job_failed',
  'internal',
  'timeout',
] as const

export type UpaiErrorCode = (typeof UPAI_ERROR_CODES)[number]

export const UPAI_JOB_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
  'expired',
] as const

export type UpaiJobStatus = (typeof UPAI_JOB_STATUSES)[number]

export const UPAI_MODEL_STATUSES = ['ready', 'stale', 'invalid'] as const

export type UpaiModelStatus = (typeof UPAI_MODEL_STATUSES)[number]

export const UPAI_WAITING_ON = ['pack_queue', 'comfyui_busy'] as const

export type UpaiWaitingOn = (typeof UPAI_WAITING_ON)[number]

export const UPAI_JOB_KINDS = ['video', 'image'] as const

export type UpaiJobKind = (typeof UPAI_JOB_KINDS)[number]

export const UpaiPromptSchema = z
  .object({ required: z.boolean(), max_chars: z.number().int().min(0) })
  .loose()

export type UpaiPrompt = z.infer<typeof UpaiPromptSchema>

export const UpaiReferenceCountSchema = z
  .object({ max: z.number().int().min(0), required: z.number().int().min(0) })
  .loose()

export type UpaiReferenceCount = z.infer<typeof UpaiReferenceCountSchema>

export const UpaiReferenceCountsSchema = z
  .object({
    image: UpaiReferenceCountSchema,
    video: UpaiReferenceCountSchema,
    audio: UpaiReferenceCountSchema,
  })
  .loose()

export type UpaiReferenceCounts = z.infer<typeof UpaiReferenceCountsSchema>

export const UpaiReferenceLimitSchema = z
  .object({
    max_bytes: z.number().int().min(0),
    formats: z.array(z.string()),
  })
  .loose()

export type UpaiReferenceLimit = z.infer<typeof UpaiReferenceLimitSchema>

export const UpaiReferenceLimitsSchema = z
  .object({
    image: UpaiReferenceLimitSchema,
  })
  .loose()

export type UpaiReferenceLimits = z.infer<typeof UpaiReferenceLimitsSchema>

export const UpaiFramesSchema = z
  .object({
    start: z.boolean(),
    end: z.boolean(),
    start_required: z.boolean(),
    end_required: z.boolean(),
  })
  .loose()

export type UpaiFrames = z.infer<typeof UpaiFramesSchema>

export const UpaiDurationSchema = z
  .object({
    min: z.number(),
    max: z.number(),
    default: z.number(),
    step: z.number(),
  })
  .loose()

export type UpaiDuration = z.infer<typeof UpaiDurationSchema>

export const UpaiFrameRuleSchema = z
  .object({ mod: z.number().int(), add: z.number().int() })
  .loose()

export type UpaiFrameRule = z.infer<typeof UpaiFrameRuleSchema>

export const UpaiSizeMapSchema = z.record(z.string(), z.record(z.string(), z.string()))

export type UpaiSizeMap = z.infer<typeof UpaiSizeMapSchema>

export const UpaiCountSchema = z.object({ max: z.number().int().min(0) }).loose()

export type UpaiCount = z.infer<typeof UpaiCountSchema>

export const UpaiCapabilitiesSchema = z
  .object({
    prompt: UpaiPromptSchema,
    negative_prompt: z.boolean(),
    references: UpaiReferenceCountsSchema,
    resolutions: z.array(z.string()),
    default_resolution: z.string(),
    aspect_ratios: z.array(z.string()),
    default_aspect_ratio: z.string(),
    sizes: UpaiSizeMapSchema,
    seed: z.boolean(),
    reference_limits: UpaiReferenceLimitsSchema,
    frames: UpaiFramesSchema.optional(),
    duration: UpaiDurationSchema.optional(),
    fps: z.number().optional(),
    frame_rule: UpaiFrameRuleSchema.optional(),
    audio_output: z.boolean().optional(),
    count: UpaiCountSchema.optional(),
  })
  .loose()

export type UpaiCapabilities = z.infer<typeof UpaiCapabilitiesSchema>

export const UpaiWorkflowSchema = z.object({ id: z.string(), name: z.string() }).loose()

export type UpaiWorkflow = z.infer<typeof UpaiWorkflowSchema>

export const UpaiPricingSchema = z.object({ per_run_usd: z.number() }).loose()

export type UpaiPricing = z.infer<typeof UpaiPricingSchema>

export const UpaiModelSchema = z
  .object({
    id: z.string().regex(MODEL_ID_PATTERN),
    name: z.string(),
    description: z.string(),
    kind: z.enum(UPAI_JOB_KINDS),
    status: z.enum(UPAI_MODEL_STATUSES),
    status_reason: z.string().nullable(),
    updated_at: z.string(),
    pricing: UpaiPricingSchema,
    capabilities: UpaiCapabilitiesSchema,
    workflow: UpaiWorkflowSchema.nullish(),
  })
  .loose()

export type UpaiModel = z.infer<typeof UpaiModelSchema>

export const UpaiModelListSchema = z
  .object({
    data: z.array(UpaiModelSchema),
  })
  .loose()

export type UpaiModelList = z.infer<typeof UpaiModelListSchema>

export const UpaiHealthSchema = z
  .object({
    protocol: z.literal(1),
    server: z.string(),
    server_version: z.string(),
    implementation: z.string(),
    implementation_version: z.string(),
    auth_required: z.boolean(),
    lan_allowed: z.boolean(),
    max_upload_bytes: z.number().int().min(0),
    upload_quota_bytes: z.number().int().min(0),
    instance_id: z.string().regex(INSTANCE_ID_PATTERN),
    max_running: z.number().int().min(1).max(8),
  })
  .loose()

export type UpaiHealth = z.infer<typeof UpaiHealthSchema>

export const UpaiJobProgressSchema = z
  .object({
    percent: z.number().int().min(0).max(100),
    node: z.string().nullish(),
    value: z.number().int().nullish(),
    max: z.number().int().nullish(),
    queue_position: z.number().int().nullish(),
    waiting_on: z.enum(UPAI_WAITING_ON).nullish(),
  })
  .loose()

export type UpaiJobProgress = z.infer<typeof UpaiJobProgressSchema>

export const UpaiJobUsageSchema = z.object({ cost: z.number() }).loose()

export type UpaiJobUsage = z.infer<typeof UpaiJobUsageSchema>

export const UpaiJobSchema = z
  .object({
    id: z.string().regex(UUID_V4_PATTERN),
    kind: z.enum(UPAI_JOB_KINDS),
    model: z.string(),
    status: z.enum(UPAI_JOB_STATUSES),
    progress: UpaiJobProgressSchema.nullable(),
    seed: z.number().int().min(0).max(2147483647).nullable(),
    urls: z.array(z.url()).nullable(),
    error: z.string().nullable(),
    usage: UpaiJobUsageSchema,
    created_at: z.string(),
    started_at: z.string().nullable(),
    finished_at: z.string().nullable(),
    expires_at: z.number().int().nullable(),
  })
  .loose()

export type UpaiJob = z.infer<typeof UpaiJobSchema>

export const UpaiErrorDetailsSchema = z.record(z.string(), z.unknown())

export type UpaiErrorDetails = z.infer<typeof UpaiErrorDetailsSchema>

export const UpaiErrorSchema = z
  .object({
    code: z.enum(UPAI_ERROR_CODES),
    message: z.string(),
    details: UpaiErrorDetailsSchema,
  })
  .loose()

export type UpaiError = z.infer<typeof UpaiErrorSchema>

export const UpaiErrorResponseSchema = z.object({ error: UpaiErrorSchema }).loose()

export type UpaiErrorResponse = z.infer<typeof UpaiErrorResponseSchema>

export const UpaiUploadSchema = z
  .object({
    sha256: z.string().regex(SHA256_PATTERN),
    ref: z.string().regex(UPLOAD_REF_PATTERN),
    size: z.number().int().min(0),
    content_type: z.string(),
    filename: z.string(),
  })
  .loose()

export type UpaiUpload = z.infer<typeof UpaiUploadSchema>

export const UpaiSyncImageSchema = z
  .object({ b64_json: z.string(), media_type: z.string() })
  .loose()

export type UpaiSyncImage = z.infer<typeof UpaiSyncImageSchema>

export const UpaiSyncImagesSchema = z
  .object({
    data: z.array(UpaiSyncImageSchema).min(1),
    usage: UpaiJobUsageSchema,
  })
  .loose()

export type UpaiSyncImages = z.infer<typeof UpaiSyncImagesSchema>

export const UpaiCreatedJobSchema = z
  .object({
    id: z.string().regex(UUID_V4_PATTERN),
    status: z.literal('pending'),
    polling_url: z.string(),
  })
  .loose()

export type UpaiCreatedJob = z.infer<typeof UpaiCreatedJobSchema>
