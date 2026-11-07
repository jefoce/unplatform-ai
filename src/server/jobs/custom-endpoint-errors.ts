import 'server-only'

import type { UpaiError } from '@/core/protocol/upai'

import { ProviderError, type ProviderErrorKind } from '../providers/provider-error'

interface CustomErrorParams {
  kind: ProviderErrorKind
  message: string
  status: number
  code: string | null
}

interface ResponseErrorParams {
  status: number
  error: UpaiError | null
  isMissingToken: boolean
}

interface SizeErrorParams {
  size: number
  maxBytes: number
}

export function customEndpointError(params: CustomErrorParams): ProviderError {
  const { kind, message, status, code } = params

  return new ProviderError({
    providerId: 'custom',
    kind,
    message,
    storedMessage: message,
    status,
    code,
  })
}

export function endpointRemovedError(): ProviderError {
  return customEndpointError({
    kind: 'not_found',
    status: 0,
    code: 'endpoint_removed',
    message: 'This endpoint was removed.',
  })
}

function endpointUnauthorizedError(isMissingToken: boolean): ProviderError {
  if (isMissingToken) {
    return customEndpointError({
      kind: 'auth',
      status: 401,
      code: 'unauthorized',
      message: 'The endpoint needs a token. Add it in Settings.',
    })
  }

  return customEndpointError({
    kind: 'auth',
    status: 401,
    code: 'unauthorized',
    message: 'The endpoint token is not valid. Open Settings and paste the token.',
  })
}

function endpointForbiddenError(): ProviderError {
  return customEndpointError({
    kind: 'auth',
    status: 403,
    code: 'forbidden',
    message:
      'This computer cannot reach ComfyUI. Enable LAN access in ComfyUI Settings > Unplatform AI, or add a token.',
  })
}

function endpointQuotaError(): ProviderError {
  return customEndpointError({
    kind: 'input',
    status: 413,
    code: null,
    message: 'ComfyUI upload space is full',
  })
}

function endpointTooLargeError(): ProviderError {
  return customEndpointError({
    kind: 'input',
    status: 413,
    code: 'too_large',
    message: 'The file is too large for ComfyUI. Use a smaller file or raise the limit in ComfyUI.',
  })
}

export function endpointSizeError(params: SizeErrorParams): ProviderError {
  const { size, maxBytes } = params
  const mb = Math.ceil(size / (1024 * 1024))
  const maxMb = Math.max(1, Math.floor(maxBytes / (1024 * 1024)))

  return customEndpointError({
    kind: 'input',
    status: 413,
    code: 'too_large',
    message: `The file is too large for ComfyUI (${mb} MB, max ${maxMb} MB). Use a smaller file or raise the limit in ComfyUI.`,
  })
}

export function endpointConnectionError(): ProviderError {
  return customEndpointError({
    kind: 'timeout',
    status: 0,
    code: 'comfy_unavailable',
    message: 'ComfyUI is not reachable. Start ComfyUI, then try again.',
  })
}

export function endpointProtocolError(): ProviderError {
  return customEndpointError({
    kind: 'server',
    status: 0,
    code: 'protocol',
    message: 'This server does not speak upai/1.',
  })
}

export function endpointResponseError(params: ResponseErrorParams): ProviderError {
  const { status, error, isMissingToken } = params

  if (status === 401) {
    return endpointUnauthorizedError(isMissingToken)
  }

  if (status === 403) {
    return endpointForbiddenError()
  }

  if (status === 413) {
    return tooLargeResponse(error)
  }

  let kind: ProviderErrorKind = 'input'

  if (status >= 500) {
    kind = 'server'
  }

  return customEndpointError({
    kind,
    status,
    code: error?.code ?? null,
    message: error?.message ?? `Upload failed (HTTP ${status})`,
  })
}

function tooLargeResponse(error: UpaiError | null): ProviderError {
  if (error?.details.reason === 'quota') {
    return endpointQuotaError()
  }

  return endpointTooLargeError()
}
