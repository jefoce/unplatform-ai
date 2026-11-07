import 'server-only'

import { isNil } from 'lodash-es'

import type { EndpointHealthStatus } from '@/core/endpoints'
import { isNonEmptyString } from '@/core/guards'
import { type UpaiError, UpaiErrorResponseSchema, type UpaiJob } from '@/core/protocol/upai'

import { ProviderError, type ProviderErrorKind } from '../provider-error'

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

interface CustomErrorParams {
  kind: ProviderErrorKind
  status: number
  code: string | null
  message: string
}

function customError(params: CustomErrorParams): ProviderError {
  const { kind, status, code, message } = params

  return new ProviderError({
    providerId: 'custom',
    kind,
    message,
    storedMessage: message,
    status,
    code,
  })
}

/** Health state from the last failed request, so a poll marks the endpoint. */
export function healthStateOf(error: ProviderError): EndpointHealthStatus {
  if (error.status === 401) {
    return 'unauthorized'
  }

  if (error.status === 403) {
    return 'forbidden'
  }

  if (error.code === 'protocol') {
    return 'protocol'
  }

  return 'unreachable'
}

function upaiErrorText(error: UpaiError): string {
  const base = `upai:${error.code}: ${error.message}`
  const field = error.details.field

  if (!isNonEmptyString(field)) {
    return base
  }

  return `${base} details.field=${field}`
}

/** Every protocol error keeps the raw `upai:<code>: <message>` line for the record. */
export async function providerErrorFromResponse(res: Response): Promise<ProviderError> {
  const payload: unknown = await res.json().catch(() => {
    return null
  })

  const parsed = UpaiErrorResponseSchema.safeParse(payload)

  if (parsed.success) {
    const code = parsed.data.error.code

    return customError({
      kind: kindForStatus(res.status),
      status: res.status,
      code,
      message: upaiErrorText(parsed.data.error),
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

export function networkError(error: unknown): ProviderError {
  const isTimeout =
    error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')

  let code = 'comfy_unavailable'
  let detail = 'Endpoint unreachable'

  if (isTimeout) {
    code = 'timeout'
    detail = 'Request timed out'
  }

  return customError({
    kind: 'server',
    status: 0,
    code,
    message: `upai:${code}: ${detail}`,
  })
}

export function protocolError(detail: string): ProviderError {
  return customError({
    kind: 'server',
    status: 0,
    code: 'protocol',
    message: `upai:internal: ${detail}`,
  })
}

export function endpointRemovedError(): ProviderError {
  return customError({
    kind: 'server',
    status: 0,
    code: 'endpoint_removed',
    message: 'upai:endpoint_removed: Endpoint removed',
  })
}

export function jobFailureError(job: UpaiJob): ProviderError {
  let detail = `Job ${job.status}`

  if (isNonEmptyString(job.error)) {
    detail = job.error
  }

  return customError({
    kind: 'server',
    status: 0,
    code: 'job_failed',
    message: `upai:job_failed: ${detail}`,
  })
}

/** Raw text of a caught value, for one failed image item. */
export function errorDetail(error: unknown): string {
  if (error instanceof ProviderError) {
    return error.storedMessage
  }

  if (error instanceof Error && !isNil(error.message)) {
    return error.message
  }

  return 'Image fetch failed'
}

export function timeoutError(): ProviderError {
  return customError({
    kind: 'server',
    status: 0,
    code: 'timeout',
    message: 'upai:timeout: Image job did not finish',
  })
}
