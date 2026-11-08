import 'server-only'

import { openAsBlob } from 'node:fs'

import { isNil } from 'lodash-es'

import { FETCH_TIMEOUTS, MAX_JSON_BODY_BYTES } from '@/core/constants'
import {
  type UpaiError,
  UpaiErrorResponseSchema,
  type UpaiHealth,
  UpaiHealthSchema,
  UpaiUploadSchema,
} from '@/core/protocol/upai'
import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'
import type { UploadItem } from '@/core/schemas/upload-item'

import { readCappedBody } from '../media/read-capped-body'
import { uploadPaths } from '../paths'
import { getEndpoint, getEndpointToken } from '../providers/custom/endpoint-source'
import { endpointRemovedError } from '../providers/custom/errors'
import { customRequest, requestHeaders } from '../providers/custom/http'
import {
  endpointProtocolError,
  endpointResponseError,
  endpointSizeError,
} from './custom-endpoint-errors'

interface HealthParams {
  endpoint: CustomEndpoint
  signal?: AbortSignal
}

interface EnsureRefParams {
  endpoint: CustomEndpoint
  upload: UploadItem
  sha256: string
  signal?: AbortSignal
}

interface PostUploadParams {
  endpoint: CustomEndpoint
  upload: UploadItem
  signal?: AbortSignal
}

interface SizeParams {
  size: number
  maxBytes: number
}

/** Reads the endpoint by id. A removed or missing endpoint is its own error. */
export async function loadUploadTarget(instanceId: string | null): Promise<CustomEndpoint> {
  if (isNil(instanceId)) {
    throw endpointRemovedError()
  }

  const endpoint = await getEndpoint(instanceId)

  if (isNil(endpoint)) {
    throw endpointRemovedError()
  }

  return endpoint
}

export async function loadEndpointHealth(params: HealthParams): Promise<UpaiHealth> {
  const { endpoint, signal } = params

  const res = await customRequest({
    endpoint,
    path: '/api/v1/health',
    init: { headers: requestHeaders(endpoint, false), signal, cache: 'no-store' },
    timeoutMs: FETCH_TIMEOUTS.meta,
  })

  if (!res.ok) {
    throw await endpointError(res, endpoint)
  }

  const payload = await res.json().catch(() => {
    return null
  })

  const parsed = UpaiHealthSchema.safeParse(payload)

  if (!parsed.success) {
    throw endpointProtocolError()
  }

  return parsed.data
}

export function checkUploadSize(params: SizeParams): void {
  const { size, maxBytes } = params

  if (maxBytes <= 0 || size <= maxBytes) {
    return
  }

  throw endpointSizeError(params)
}

export async function ensureUploadRef(params: EnsureRefParams): Promise<string> {
  const { endpoint, upload, sha256, signal } = params

  const res = await customRequest({
    endpoint,
    path: `/api/v1/uploads/${sha256}`,
    init: { method: 'HEAD', headers: requestHeaders(endpoint, false), signal },
    timeoutMs: FETCH_TIMEOUTS.meta,
  })

  if (res.status === 200) {
    return uploadRef(sha256)
  }

  if (res.status !== 404) {
    throw await endpointError(res, endpoint)
  }

  return postUpload({ endpoint, upload, signal })
}

async function postUpload(params: PostUploadParams): Promise<string> {
  const { endpoint, upload, signal } = params
  const { media } = uploadPaths(upload.id, upload.ext)

  const blob = await openAsBlob(media, { type: upload.mime })
  const form = new FormData()

  form.append('file', blob, upload.originalName)

  const res = await customRequest({
    endpoint,
    path: '/api/v1/uploads',
    init: { method: 'POST', body: form, headers: requestHeaders(endpoint, false), signal },
    timeoutMs: FETCH_TIMEOUTS.submit,
  })

  if (res.status !== 201) {
    throw await endpointError(res, endpoint)
  }

  const payload = await res.json().catch(() => {
    return null
  })

  const parsed = UpaiUploadSchema.safeParse(payload)

  if (!parsed.success) {
    throw endpointProtocolError()
  }

  return parsed.data.ref
}

export function uploadRef(sha256: string): string {
  return `upai-upload:${sha256}`
}

async function endpointError(res: Response, endpoint: CustomEndpoint): Promise<Error> {
  const payload = await readCappedBody(res, MAX_JSON_BODY_BYTES)
    .then((body) => {
      return JSON.parse(body.toString('utf8')) as unknown
    })
    .catch(() => {
      return null
    })

  const parsed = UpaiErrorResponseSchema.safeParse(payload)
  let error: UpaiError | null = null

  if (parsed.success) {
    error = parsed.data.error
  }

  return endpointResponseError({
    status: res.status,
    error,
    isMissingToken: isNil(getEndpointToken(endpoint.id)),
  })
}
