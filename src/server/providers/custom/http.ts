import 'server-only'

import { isNil } from 'lodash-es'

import { FETCH_TIMEOUTS, MAX_JSON_BODY_BYTES } from '@/core/constants'
import { isNonEmptyString } from '@/core/guards'
import { UpaiErrorResponseSchema } from '@/core/protocol/upai'
import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'
import type { Dict } from '@/core/utility-types'

import { BodyTooLargeError, readCappedBody } from '../../media/read-capped-body'
import { secretsReady } from '../../secrets'
import type { ProviderError, ProviderErrorKind } from '../provider-error'
import { getEndpointToken } from './endpoint-source'
import { customError, networkError, normalizeUpaiError, protocolError } from './errors'

const STATUS_CODES: Readonly<Partial<Record<number, string>>> = {
  400: 'invalid_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  405: 'method_not_allowed',
  413: 'too_large',
  422: 'workflow_invalid',
  429: 'queue_full',
  500: 'internal',
  502: 'job_failed',
  503: 'comfy_unavailable',
  504: 'timeout',
}

/** Local endpoints never bill an unknown amount, so a timeout stays a plain server error. */
function kindForStatus(status: number): ProviderErrorKind {
  if (status === 401 || status === 403) {
    return 'auth'
  }

  if (status === 404) {
    return 'not_found'
  }

  if (status === 429) {
    return 'rate_limit'
  }

  if (status === 400 || status === 413 || status === 422 || status === 405) {
    return 'input'
  }

  if (status >= 500) {
    return 'server'
  }

  return 'unknown'
}

function codeForStatus(status: number): string {
  return STATUS_CODES[status] ?? 'internal'
}

/** Scheme, host and port only. A pasted `/upai` is dropped by rebuilding the URL. */
function endpointOrigin(endpoint: CustomEndpoint): string {
  return new URL(endpoint.baseUrl).origin
}

function endpointBaseUrl(endpoint: CustomEndpoint): string {
  return `${endpointOrigin(endpoint)}/upai`
}

function endpointHostname(endpoint: CustomEndpoint): string {
  return new URL(endpoint.baseUrl).hostname
}

/** Hosts a job content URL may point at. Empty when the base URL is invalid. */
export function endpointContentHosts(endpoint: CustomEndpoint): readonly string[] {
  try {
    return [endpointHostname(endpoint)]
  } catch {
    return []
  }
}

export function requestHeaders(isJson: boolean): Dict<string> {
  if (!isJson) {
    return {}
  }

  return { 'Content-Type': 'application/json' }
}

export interface CustomRequestParams {
  endpoint: CustomEndpoint
  path: string
  init: RequestInit
  timeoutMs: number
}

/** Pinned to the endpoint origin, never follows a redirect. */
export async function customRequest(params: CustomRequestParams): Promise<Response> {
  const { endpoint, path, init, timeoutMs } = params

  await secretsReady()

  const url = new URL(`${endpointBaseUrl(endpoint)}${path}`)

  if (url.origin !== endpointOrigin(endpoint)) {
    throw protocolError('Request outside the endpoint origin')
  }

  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  let signal = timeoutSignal

  if (!isNil(init.signal)) {
    signal = AbortSignal.any([init.signal, timeoutSignal])
  }

  const headers: Dict<string> = Object.fromEntries(new Headers(init.headers))

  const token = getEndpointToken(endpoint.id)

  if (!isNil(token)) {
    headers.Authorization = `Bearer ${token}`
  }

  let res: Response

  try {
    res = await fetch(url, {
      ...init,
      headers,
      redirect: 'manual',
      signal,
    })
  } catch (error) {
    throw networkError(error)
  }

  if (res.status >= 300 && res.status < 400) {
    if (!isNil(res.body)) {
      await res.body.cancel().catch(() => {})
    }

    throw protocolError('Endpoint redirect is not allowed')
  }

  return res
}

/** Reads a custom JSON body under the byte cap. Null on a parse failure. */
export async function readCustomJson(
  res: Response,
  maxBytes: number = MAX_JSON_BODY_BYTES,
): Promise<unknown> {
  const declared = res.headers.get('content-length')

  if (!isNil(declared) && Number(declared) > maxBytes) {
    await res.body?.cancel()

    throw protocolError('Response body is larger than the limit')
  }

  try {
    const body = await readCappedBody(res, maxBytes)

    return JSON.parse(body.toString('utf8')) as unknown
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      throw protocolError('Response body is larger than the limit')
    }

    return null
  }
}

/** Every protocol error keeps the raw `upai:<code>: <message>` line for the record. */
export async function providerErrorFromResponse(res: Response): Promise<ProviderError> {
  const payload: unknown = await readCustomJson(res)

  const parsed = UpaiErrorResponseSchema.safeParse(payload)

  if (parsed.success) {
    const normalized = normalizeUpaiError(parsed.data.error)

    return customError({
      kind: kindForStatus(res.status),
      status: res.status,
      code: normalized.code,
      message: normalized.message,
    })
  }

  const code = codeForStatus(res.status)
  let base = `HTTP ${res.status}`

  if (isNonEmptyString(res.statusText)) {
    base = res.statusText
  }

  const message = `upai:${code}: ${base}`

  return customError({ kind: kindForStatus(res.status), status: res.status, code, message })
}

interface DeleteCustomJobParams {
  endpoint: CustomEndpoint
  path: string
}

/** Deletes one final custom job. 204 and 404 count as done for best effort. */
export async function deleteCustomJob(params: DeleteCustomJobParams): Promise<void> {
  const { endpoint, path } = params

  const res = await customRequest({
    endpoint,
    path,
    init: { method: 'DELETE', headers: requestHeaders(false) },
    timeoutMs: FETCH_TIMEOUTS.poll,
  })

  if (res.status === 204 || res.status === 404) {
    return
  }

  if (!res.ok) {
    throw await providerErrorFromResponse(res)
  }
}

export async function requestJson(params: CustomRequestParams): Promise<unknown> {
  const res = await customRequest(params)

  if (!res.ok) {
    throw await providerErrorFromResponse(res)
  }

  return readCustomJson(res)
}
