import 'server-only'

import { isNil } from 'lodash-es'

import type { EndpointHealthStatus } from '@/core/endpoints'
import { isNonEmptyString } from '@/core/guards'
import { type UpaiJob } from '@/core/protocol/upai'

import { ProviderError, type ProviderErrorKind } from '../provider-error'

interface CustomErrorParams {
  kind: ProviderErrorKind
  status: number
  code: string | null
  message: string
}

export function customError(params: CustomErrorParams): ProviderError {
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
