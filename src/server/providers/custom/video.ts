import 'server-only'

import { isNil } from 'lodash-es'

import { FETCH_TIMEOUTS } from '@/core/constants'
import { primaryBinding } from '@/core/presets/common/bindings'
import type { VideoPreset } from '@/core/presets/video/types'
import type { PricingInfo } from '@/core/pricing/types'
import {
  UpaiCreatedJobSchema,
  type UpaiJob,
  UpaiJobSchema,
  type UpaiModel,
  UpaiModelListSchema,
} from '@/core/protocol/upai'
import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'
import { asJobStatus } from '@/core/submit-state'
import type { TestResult } from '@/core/types'

import type {
  ContentRequest,
  EndpointSignal,
  JobProgress,
  JobRef,
  JobSnapshot,
  ProviderAccount,
  ProviderModel,
  ProviderModelList,
  SubmitJobParams,
  SubmittedJob,
  VideoProvider,
} from '../types'
import { buildVideoBody } from './body'
import { jobFailureError, protocolError } from './errors'
import { testCustomEndpoint } from './health'
import {
  customRequest,
  endpointContentHosts,
  providerErrorFromResponse,
  requestHeaders,
  requestJson,
} from './http'

export function toJobSnapshot(job: UpaiJob): JobSnapshot {
  const error = job.status === 'failed' ? jobFailureError(job).storedMessage : job.error

  const snapshot: JobSnapshot = {
    status: asJobStatus(job.status) ?? 'pending',
    generationId: null,
    expiresAt: expiresAtOf(job),
    urls: job.urls,
    usage: {
      costUsd: job.usage.cost,
      isByok: false,
      usesEstimatedCost: false,
    },
    error,
  }

  if (!isNil(job.progress)) {
    const progress: JobProgress = {
      percent: job.progress.percent,
      node: job.progress.node ?? null,
      queuePosition: job.progress.queue_position ?? null,
      waitingOn: job.progress.waiting_on ?? null,
    }

    snapshot.progress = progress
  }

  return snapshot
}

function expiresAtOf(job: UpaiJob): number | null {
  if (isNil(job.expires_at)) {
    return null
  }

  return job.expires_at * 1000
}

function durationsOf(model: UpaiModel): readonly number[] | null {
  const duration = model.capabilities.duration

  if (isNil(duration)) {
    return null
  }

  const step = duration.step > 0 ? duration.step : 1
  const count = Math.floor((duration.max - duration.min) / step) + 1

  if (count <= 0) {
    return null
  }

  return Array.from({ length: count }, (_, index) => {
    return duration.min + index * step
  })
}

function frameImagesOf(model: UpaiModel): readonly string[] | null {
  const frames = model.capabilities.frames

  if (isNil(frames) || !frames.start) {
    return null
  }

  if (!frames.end) {
    return ['first_frame']
  }

  return ['first_frame', 'last_frame']
}

function toProviderModel(model: UpaiModel): ProviderModel {
  return {
    modelId: model.id,
    durations: durationsOf(model),
    resolutions: model.capabilities.resolutions,
    aspectRatios: model.capabilities.aspect_ratios,
    frameImages: frameImagesOf(model),
    generatesAudio: model.capabilities.audio_output ?? null,
    hasSeed: model.capabilities.seed,
  }
}

interface JobPathParams {
  endpoint: CustomEndpoint
  job: JobRef
}

function videoPath(params: JobPathParams): string {
  return `/api/v1/videos/${encodeURIComponent(params.job.jobId)}`
}

interface SubmitParams {
  endpoint: CustomEndpoint
  params: SubmitJobParams
}

async function submitJob(params: SubmitParams): Promise<SubmittedJob> {
  const { endpoint, params: submit } = params

  const payload = await requestJson({
    endpoint,
    path: '/api/v1/videos',
    init: {
      method: 'POST',
      headers: requestHeaders(endpoint, true),
      body: JSON.stringify(buildVideoBody(submit)),
    },
    timeoutMs: FETCH_TIMEOUTS.submit,
  })

  const parsed = UpaiCreatedJobSchema.safeParse(payload)

  if (!parsed.success) {
    throw protocolError('Invalid submit response')
  }

  return { jobId: parsed.data.id, status: asJobStatus(parsed.data.status) ?? 'pending' }
}

async function readJob(params: JobPathParams): Promise<JobSnapshot> {
  const { endpoint } = params

  const payload = await requestJson({
    endpoint,
    path: videoPath(params),
    init: { headers: requestHeaders(endpoint, false), cache: 'no-store' },
    timeoutMs: FETCH_TIMEOUTS.poll,
  })

  const parsed = UpaiJobSchema.safeParse(payload)

  if (!parsed.success) {
    throw protocolError('Invalid job response')
  }

  return toJobSnapshot(parsed.data)
}

async function cancelJob(params: JobPathParams): Promise<void> {
  const { endpoint } = params

  const res = await customRequest({
    endpoint,
    path: `${videoPath(params)}/cancel`,
    init: { method: 'POST', headers: requestHeaders(endpoint, false) },
    timeoutMs: FETCH_TIMEOUTS.poll,
  })

  if (!res.ok) {
    throw await providerErrorFromResponse(res)
  }
}

interface ContentParams {
  endpoint: CustomEndpoint
  request: ContentRequest
}

async function fetchContent(params: ContentParams): Promise<Response> {
  const { endpoint, request } = params

  const res = await customRequest({
    endpoint,
    path: `${videoPath({ endpoint, job: request.job })}/content?index=${request.index}`,
    init: { headers: requestHeaders(endpoint, false), cache: 'no-store' },
    timeoutMs: FETCH_TIMEOUTS.content,
  })

  if (!res.ok) {
    throw await providerErrorFromResponse(res)
  }

  return res
}

function getPricing(preset: VideoPreset): Promise<PricingInfo> {
  const fallback = { ...primaryBinding(preset).pricing.fallback }

  return Promise.resolve({
    skus: fallback,
    listSkus: { ...fallback },
    discount: 0,
    source: 'fallback',
    fetchedAt: new Date().toISOString(),
  })
}

function getAccount(): Promise<ProviderAccount> {
  return Promise.resolve({
    balance: null,
    keyLimitRemaining: null,
    keyLimit: null,
    usageDaily: null,
    usageMonthly: null,
    source: 'none',
    fetchedAt: new Date().toISOString(),
    error: null,
  })
}

function listEndpoints(): Promise<EndpointSignal> {
  return Promise.resolve({ state: 'present', reason: null })
}

async function listModels(endpoint: CustomEndpoint): Promise<ProviderModelList> {
  const payload = await requestJson({
    endpoint,
    path: '/api/v1/videos/models',
    init: { headers: requestHeaders(endpoint, false), cache: 'no-store' },
    timeoutMs: FETCH_TIMEOUTS.meta,
  })

  const parsed = UpaiModelListSchema.safeParse(payload)

  if (!parsed.success) {
    throw protocolError('Invalid model list response')
  }

  return { models: parsed.data.data.map(toProviderModel), isFresh: true }
}

function testConnection(endpoint: CustomEndpoint): Promise<TestResult> {
  return testCustomEndpoint(endpoint)
}

/** One upai/1 adapter per endpoint instance. */
export function createCustomVideoProvider(endpoint: CustomEndpoint): VideoProvider {
  return {
    id: 'custom',
    contentHosts: endpointContentHosts(endpoint),
    isConfigured: () => {
      return true
    },
    submit: (submitParams) => {
      return submitJob({ endpoint, params: submitParams })
    },
    getJob: (job) => {
      return readJob({ endpoint, job })
    },
    cancel: (job) => {
      return cancelJob({ endpoint, job })
    },
    fetchContent: (request) => {
      return fetchContent({ endpoint, request })
    },
    getAccount,
    getPricing,
    listModels: () => {
      return listModels(endpoint)
    },
    listEndpoints,
    testConnection: () => {
      return testConnection(endpoint)
    },
  }
}
