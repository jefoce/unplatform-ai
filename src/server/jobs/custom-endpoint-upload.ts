import 'server-only'

import { openAsBlob } from 'node:fs'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { z } from 'zod'

import { FETCH_TIMEOUTS, MAX_JSON_BODY_BYTES } from '@/core/constants'
import { isNonEmptyString } from '@/core/guards'
import {
  type UpaiError,
  UpaiErrorResponseSchema,
  type UpaiHealth,
  UpaiHealthSchema,
  UpaiUploadSchema,
} from '@/core/protocol/upai'
import { CustomEndpointFileSchema } from '@/core/schemas/custom-endpoint'
import type { UploadItem } from '@/core/schemas/upload-item'

import { readJson } from '../fs/json-file'
import { readCappedBody } from '../media/read-capped-body'
import { STORAGE_ROOT, uploadPaths } from '../paths'
import { endpointRemovedError, networkError } from '../providers/custom/errors'
import { getSecret } from '../secrets'
import {
  customEndpointError,
  endpointProtocolError,
  endpointResponseError,
  endpointSizeError,
} from './custom-endpoint-errors'

/** w-settings owns the endpoints repo. Switch to it when it lands. */
const ENDPOINTS_FILE = path.join(STORAGE_ROOT, 'data', 'endpoints.json')

const TokenMapSchema = z.record(z.string(), z.string())

export interface EndpointTarget {
  baseUrl: string
  token: string | null
}

interface EndpointRequestParams {
  target: EndpointTarget
  path: string
  init: RequestInit
  timeoutMs: number
  signal?: AbortSignal
}

interface HealthParams {
  target: EndpointTarget
  signal?: AbortSignal
}

interface EnsureRefParams {
  target: EndpointTarget
  upload: UploadItem
  sha256: string
  signal?: AbortSignal
}

interface PostUploadParams {
  target: EndpointTarget
  upload: UploadItem
  signal?: AbortSignal
}

interface SizeParams {
  size: number
  maxBytes: number
}

/** Reads the endpoint address and its token from disk and secrets. */
export async function loadUploadTarget(instanceId: string | null): Promise<EndpointTarget> {
  if (isNil(instanceId)) {
    throw endpointRemovedError()
  }

  const file = await readJson(ENDPOINTS_FILE, CustomEndpointFileSchema)

  const endpoint = file?.endpoints.find((item) => {
    return item.id === instanceId
  })

  if (!endpoint) {
    throw endpointRemovedError()
  }

  return { baseUrl: normalizeBaseUrl(endpoint.baseUrl), token: tokenFor(instanceId) }
}

function normalizeBaseUrl(raw: string): string {
  let url: URL

  try {
    url = new URL(raw)
  } catch {
    throw invalidAddressError()
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw invalidAddressError()
  }

  return url.origin
}

function invalidAddressError(): Error {
  return customEndpointError({
    kind: 'input',
    status: 0,
    code: 'config_invalid',
    message: 'The endpoint address is not valid. Open Settings.',
  })
}

function tokenFor(endpointId: string): string | null {
  const raw = getSecret('CUSTOM_ENDPOINT_TOKENS')

  if (!isNonEmptyString(raw)) {
    return null
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  const result = TokenMapSchema.safeParse(parsed)

  if (!result.success) {
    return null
  }

  const token = result.data[endpointId]

  if (!isNonEmptyString(token)) {
    return null
  }

  return token
}

export async function loadEndpointHealth(params: HealthParams): Promise<UpaiHealth> {
  const { target, signal } = params

  const res = await endpointFetch({
    target,
    path: '/upai/api/v1/health',
    init: { method: 'GET' },
    timeoutMs: FETCH_TIMEOUTS.meta,
    signal,
  })

  if (!res.ok) {
    throw await endpointError(res, target)
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
  const { target, upload, sha256, signal } = params

  const res = await endpointFetch({
    target,
    path: `/upai/api/v1/uploads/${sha256}`,
    init: { method: 'HEAD' },
    timeoutMs: FETCH_TIMEOUTS.meta,
    signal,
  })

  if (res.status === 200) {
    return uploadRef(sha256)
  }

  if (res.status !== 404) {
    throw await endpointError(res, target)
  }

  return postUpload({ target, upload, signal })
}

async function postUpload(params: PostUploadParams): Promise<string> {
  const { target, upload, signal } = params
  const { media } = uploadPaths(upload.id, upload.ext)

  const blob = await openAsBlob(media, { type: upload.mime })
  const form = new FormData()

  form.append('file', blob, upload.originalName)

  const res = await endpointFetch({
    target,
    path: '/upai/api/v1/uploads',
    init: { method: 'POST', body: form },
    timeoutMs: FETCH_TIMEOUTS.submit,
    signal,
  })

  if (res.status !== 201) {
    throw await endpointError(res, target)
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

async function endpointFetch(params: EndpointRequestParams): Promise<Response> {
  const { target, path: route, init, timeoutMs, signal } = params
  const timeout = AbortSignal.timeout(timeoutMs)
  let combined = timeout

  if (!isNil(signal)) {
    combined = AbortSignal.any([signal, timeout])
  }

  let res: Response

  try {
    res = await fetch(`${target.baseUrl}${route}`, {
      ...init,
      headers: authHeaders(target),
      redirect: 'manual',
      signal: combined,
    })
  } catch (error) {
    if (signal?.aborted === true) {
      throw error
    }

    throw networkError(error)
  }

  if (res.status >= 300 && res.status <= 399) {
    await res.body?.cancel()

    throw endpointProtocolError()
  }

  return res
}

function authHeaders(target: EndpointTarget): HeadersInit {
  if (isNil(target.token)) {
    return {}
  }

  return { Authorization: `Bearer ${target.token}` }
}

async function endpointError(res: Response, target: EndpointTarget): Promise<Error> {
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
    isMissingToken: isNil(target.token),
  })
}
