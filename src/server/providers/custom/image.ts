import 'server-only'

import { isNil } from 'lodash-es'

import {
  CUSTOM_IMAGE_MAX_WAIT_MS,
  FETCH_TIMEOUTS,
  IMAGE_COUNT_MAX,
  IMAGE_OUTPUT_MAX_BYTES,
} from '@/core/constants'
import { isNonEmptyString } from '@/core/guards'
import {
  UpaiCreatedJobSchema,
  type UpaiJob,
  UpaiJobSchema,
  type UpaiJobStatus,
  type UpaiModel,
  UpaiModelListSchema,
} from '@/core/protocol/upai'
import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'
import type { TestResult } from '@/core/types'

import { BodyTooLargeError, readCappedBody } from '../../media/read-capped-body'
import type {
  EndpointSignal,
  ImageGenerateParams,
  ImageProvider,
  ImageResult,
  ImageResultItem,
  JobRef,
  ProviderImageModel,
  ProviderImageModelList,
} from '../types'
import { buildImageBody } from './body'
import { getEndpointSync } from './endpoint-source'
import {
  endpointRemovedError,
  errorDetail,
  jobFailureError,
  protocolError,
  timeoutError,
} from './errors'
import { testCustomEndpoint } from './health'
import { customRequest, providerErrorFromResponse, requestHeaders, requestJson } from './http'
import { trackCustomImageJob, untrackCustomImageJob } from './image-jobs'
import { resolveCustomRunPrice } from './pricing'

const IMAGE_POLL_INTERVAL_MS = 1000
const FINAL_STATUSES: readonly UpaiJobStatus[] = ['completed', 'failed', 'cancelled', 'expired']

interface ImageJobParams {
  endpoint: CustomEndpoint
  jobId: string
}

interface ImageItemsParams {
  endpoint: CustomEndpoint
  job: UpaiJob
  count: number
}

function isFinalStatus(status: UpaiJobStatus): boolean {
  return FINAL_STATUSES.includes(status)
}

function jobPath(params: ImageJobParams, suffix = ''): string {
  return `/api/v1/images/jobs/${encodeURIComponent(params.jobId)}${suffix}`
}

function imageModelOf(model: UpaiModel): ProviderImageModel {
  return {
    modelId: model.id,
    resolutions: model.capabilities.resolutions,
    aspectRatios: model.capabilities.aspect_ratios,
    qualities: null,
    backgrounds: null,
    maxN: model.capabilities.count?.max ?? null,
    referenceMax: model.capabilities.references.image.max,
    hasSeed: model.capabilities.seed,
  }
}

async function readImageJob(params: ImageJobParams): Promise<UpaiJob> {
  const payload = await requestJson({
    endpoint: params.endpoint,
    path: jobPath(params),
    init: { headers: requestHeaders(false), cache: 'no-store' },
    timeoutMs: FETCH_TIMEOUTS.poll,
  })

  const parsed = UpaiJobSchema.safeParse(payload)

  if (!parsed.success) {
    throw protocolError('Invalid image job response')
  }

  return parsed.data
}

async function cancelImageJob(params: ImageJobParams): Promise<void> {
  const res = await customRequest({
    endpoint: params.endpoint,
    path: jobPath(params, '/cancel'),
    init: { method: 'POST', headers: requestHeaders(false) },
    timeoutMs: FETCH_TIMEOUTS.poll,
  })

  if (!res.ok) {
    throw await providerErrorFromResponse(res)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function waitForJob(params: ImageJobParams): Promise<UpaiJob> {
  const deadline = Date.now() + CUSTOM_IMAGE_MAX_WAIT_MS

  while (true) {
    if (isNil(getEndpointSync(params.endpoint.id))) {
      throw endpointRemovedError()
    }

    const job = await readImageJob(params)

    if (isFinalStatus(job.status)) {
      return job
    }

    if (Date.now() >= deadline) {
      await cancelImageJob(params).catch(() => {})

      throw timeoutError()
    }

    await sleep(IMAGE_POLL_INTERVAL_MS)
  }
}

function mediaTypeOf(res: Response): string {
  const raw = res.headers.get('content-type')

  if (isNil(raw)) {
    return 'image/png'
  }

  const [type] = raw.split(';')

  if (!isNonEmptyString(type)) {
    return 'image/png'
  }

  return type.trim()
}

async function fetchItem(params: ImageItemsParams, index: number): Promise<ImageResultItem> {
  try {
    const res = await customRequest({
      endpoint: params.endpoint,
      path: jobPath({ endpoint: params.endpoint, jobId: params.job.id }, `/content?index=${index}`),
      init: { headers: requestHeaders(false), cache: 'no-store' },
      timeoutMs: FETCH_TIMEOUTS.content,
    })

    if (!res.ok) {
      throw await providerErrorFromResponse(res)
    }

    const declared = res.headers.get('content-length')

    if (!isNil(declared) && Number(declared) > IMAGE_OUTPUT_MAX_BYTES) {
      await res.body?.cancel()

      throw new BodyTooLargeError()
    }

    const bytes = await readCappedBody(res, IMAGE_OUTPUT_MAX_BYTES)

    return { b64: bytes.toString('base64'), mediaType: mediaTypeOf(res) }
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return { error: 'upai:too_large: Image response is larger than the limit' }
    }

    return { error: errorDetail(error) }
  }
}

async function imageItems(params: ImageItemsParams): Promise<ImageResultItem[]> {
  const indexes = Array.from({ length: params.count }, (_, index) => {
    return index
  })

  return Promise.all(
    indexes.map((index) => {
      return fetchItem(params, index)
    }),
  )
}

async function generate(
  endpoint: CustomEndpoint,
  params: ImageGenerateParams,
): Promise<ImageResult> {
  const payload = await requestJson({
    endpoint,
    path: '/api/v1/images/jobs',
    init: {
      method: 'POST',
      headers: requestHeaders(true),
      body: JSON.stringify(buildImageBody(params)),
    },
    timeoutMs: FETCH_TIMEOUTS.submit,
  })

  const parsed = UpaiCreatedJobSchema.safeParse(payload)

  if (!parsed.success) {
    throw protocolError('Invalid image submit response')
  }

  const jobId = parsed.data.id

  const cancel = () => {
    return cancelImageJob({ endpoint, jobId }).catch(() => {})
  }

  trackCustomImageJob(jobId, cancel)

  try {
    const job = await waitForJob({ endpoint, jobId })

    if (job.status !== 'completed') {
      throw jobFailureError(job)
    }

    let count = Math.min(params.input.count, IMAGE_COUNT_MAX)

    if (!isNil(job.urls)) {
      count = Math.min(job.urls.length, count)
    }

    const items = await imageItems({ endpoint, job, count })
    let costUsd = job.usage.cost

    if (costUsd === 0) {
      costUsd = resolveCustomRunPrice({ endpoint, preset: params.preset, duration: 1 })
    }

    return { items, costUsd }
  } finally {
    untrackCustomImageJob(jobId)
  }
}

async function listModels(endpoint: CustomEndpoint): Promise<ProviderImageModelList> {
  const payload = await requestJson({
    endpoint,
    path: '/api/v1/images/models',
    init: { headers: requestHeaders(false), cache: 'no-store' },
    timeoutMs: FETCH_TIMEOUTS.meta,
  })

  const parsed = UpaiModelListSchema.safeParse(payload)

  if (!parsed.success) {
    throw protocolError('Invalid image model list response')
  }

  return { models: parsed.data.data.map(imageModelOf), isFresh: true }
}

function listEndpoints(): Promise<EndpointSignal> {
  return Promise.resolve({ state: 'present', reason: null })
}

function testConnection(endpoint: CustomEndpoint): Promise<TestResult> {
  return testCustomEndpoint(endpoint)
}

/** Async image jobs with polling, never the synchronous `/images` route. */
export function createCustomImageProvider(endpoint: CustomEndpoint): ImageProvider {
  return {
    id: 'custom',
    isConfigured: () => {
      return true
    },
    generate: (params) => {
      return generate(endpoint, params)
    },
    cancel: (job: JobRef) => {
      return cancelImageJob({ endpoint, jobId: job.jobId })
    },
    listModels: () => {
      return listModels(endpoint)
    },
    listEndpoints,
    testConnection: () => {
      return testConnection(endpoint)
    },
  }
}
