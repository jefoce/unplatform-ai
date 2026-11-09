import 'server-only'

import type { MediaKind } from '@/core/media/media-types'
import type { ImagePreset } from '@/core/presets/image/types'
import type { VideoPreset } from '@/core/presets/video/types'
import type { PricingInfo } from '@/core/pricing/types'
import type { UpaiWaitingOn } from '@/core/protocol/upai'
import type { ProviderKindId } from '@/core/providers/types'
import type { GenerationInput, JobStatus } from '@/core/schemas/generation-record'
import type { ImageGenerationInput } from '@/core/schemas/image-record'
import type { AccountSource, TestResult } from '@/core/types'
import type { Dict } from '@/core/utility-types'

/** Whether a model endpoint listing exists for one model id. */
export type EndpointState = 'present' | 'not_found' | 'unknown'

export interface EndpointSignal {
  state: EndpointState
  reason: string | null
}

export interface ProviderModel {
  modelId: string
  durations: readonly number[] | null
  resolutions: readonly string[] | null
  aspectRatios: readonly string[] | null
  frameImages: readonly string[] | null
  generatesAudio: boolean | null
  hasSeed: boolean | null
}

/** A provider model list and whether the fetch succeeded. */
export interface ProviderModelList {
  models: readonly ProviderModel[]
  isFresh: boolean
}

export interface ResolvedMedia {
  id: string
  kind: MediaKind
  url: string
}

export interface SubmitJobParams {
  preset: VideoPreset
  input: GenerationInput
  media: Readonly<Dict<ResolvedMedia>>
}

export interface SubmittedJob {
  jobId: string
  status: JobStatus
}

export interface JobRef {
  jobId: string
  submittedAt: string
}

export interface JobUsage {
  costUsd: number | null
  isByok: boolean | null
  usesEstimatedCost: boolean
}

export interface JobProgress {
  percent: number
  queuePosition: number | null
  waitingOn: UpaiWaitingOn | null
}

export interface JobSnapshot {
  status: JobStatus
  generationId: string | null
  expiresAt: number | null
  urls: readonly string[] | null
  usage: JobUsage | null
  error: string | null
  progress?: JobProgress
}

export interface ContentFallback {
  presetId: string
  duration: number
  resolution: string
  aspectRatio: string
}

export interface ContentRequest {
  job: JobRef
  index: number
  fallback: ContentFallback | null
}

export interface ProviderAccount {
  balance: number | null
  keyLimitRemaining: number | null
  keyLimit: number | null
  usageDaily: number | null
  usageMonthly: number | null
  source: AccountSource
  fetchedAt: string
  error: string | null
}

export interface AccountLookupParams {
  fresh?: boolean
}

export interface VideoProvider {
  readonly id: ProviderKindId

  /** Hosts allowed for a provider-supplied content URL. Subdomains count. */
  readonly contentHosts: readonly string[]
  isConfigured(): boolean
  submit(params: SubmitJobParams): Promise<SubmittedJob>
  getJob(job: JobRef): Promise<JobSnapshot>
  cancel?(job: JobRef): Promise<void>
  deleteResult?(job: JobRef): Promise<void>
  fetchContent(request: ContentRequest): Promise<Response>
  getAccount(params?: AccountLookupParams): Promise<ProviderAccount>
  getPricing(preset: VideoPreset, isForce?: boolean): Promise<PricingInfo>
  listModels(): Promise<ProviderModelList>
  listEndpoints(modelId: string): Promise<EndpointSignal>
  testConnection(): Promise<TestResult>
}

export interface ProviderImageModel {
  modelId: string
  resolutions: readonly string[] | null
  aspectRatios: readonly string[] | null
  qualities: readonly string[] | null
  backgrounds: readonly string[] | null
  maxN: number | null
  referenceMax: number | null
  hasSeed: boolean | null
}

export interface ProviderImageModelList {
  models: readonly ProviderImageModel[]
  isFresh: boolean
}

/** @public */
export interface ImageReferencePayload {
  id: string
  dataUrl: string
}

export interface ImageGenerateParams {
  preset: ImagePreset
  input: ImageGenerationInput
  references: readonly ImageReferencePayload[]
}

interface ImageResultData {
  b64: string
  mediaType: string
}

interface ImageResultError {
  error: string
}

/** @public */
export type ImageResultItem = ImageResultData | ImageResultError

export interface ImageResult {
  items: readonly ImageResultItem[]
  costUsd: number | null
  job?: JobRef
}

export interface ImageProvider {
  readonly id: ProviderKindId
  isConfigured(): boolean
  generate(params: ImageGenerateParams): Promise<ImageResult>
  cancel?(job: JobRef): Promise<void>
  deleteResult?(job: JobRef): Promise<void>
  listModels(): Promise<ProviderImageModelList>
  listEndpoints(modelId: string): Promise<EndpointSignal>
  testConnection(): Promise<TestResult>
}
