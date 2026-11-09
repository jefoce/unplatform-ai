import 'server-only'

import { isNil } from 'lodash-es'

import type { UpaiError } from '@/core/protocol/upai'
import {
  CUSTOM_FORBIDDEN_MESSAGE,
  CUSTOM_PROTOCOL_MESSAGE,
  CUSTOM_QUOTA_MESSAGE,
} from '@/core/providers/custom-messages'

import { customError, normalizeUpaiError, upaiMessage } from '../providers/custom/errors'
import { type ProviderError, type ProviderErrorKind } from '../providers/provider-error'

interface ResponseErrorParams {
  status: number
  error: UpaiError | null
  isMissingToken: boolean
}

interface SizeErrorParams {
  size: number
  maxBytes: number
}

function endpointUnauthorizedError(isMissingToken: boolean): ProviderError {
  if (isMissingToken) {
    return customError({
      kind: 'auth',
      status: 401,
      code: 'unauthorized',
      message: upaiMessage('unauthorized', 'The endpoint needs a token. Add it in Settings.'),
    })
  }

  return customError({
    kind: 'auth',
    status: 401,
    code: 'unauthorized',
    message: upaiMessage(
      'unauthorized',
      'The endpoint token is not valid. Open Settings and paste the token.',
    ),
  })
}

function endpointForbiddenError(): ProviderError {
  return customError({
    kind: 'auth',
    status: 403,
    code: 'forbidden',
    message: upaiMessage('forbidden', CUSTOM_FORBIDDEN_MESSAGE),
  })
}

function endpointQuotaError(): ProviderError {
  return customError({
    kind: 'input',
    status: 413,
    code: 'too_large',
    message: upaiMessage('too_large', CUSTOM_QUOTA_MESSAGE),
  })
}

function endpointTooLargeError(): ProviderError {
  return customError({
    kind: 'input',
    status: 413,
    code: 'too_large',
    message: upaiMessage(
      'too_large',
      'The file is too large for ComfyUI. Use a smaller file or raise the limit in ComfyUI.',
    ),
  })
}

export function endpointSizeError(params: SizeErrorParams): ProviderError {
  const { size, maxBytes } = params
  const mb = Math.ceil(size / (1024 * 1024))
  const maxMb = Math.max(1, Math.floor(maxBytes / (1024 * 1024)))

  return customError({
    kind: 'input',
    status: 413,
    code: 'too_large',
    message: upaiMessage(
      'too_large',
      `The file is too large for ComfyUI (${mb} MB, max ${maxMb} MB). Use a smaller file or raise the limit in ComfyUI.`,
    ),
  })
}

export function endpointProtocolError(): ProviderError {
  return customError({
    kind: 'server',
    status: 0,
    code: 'protocol',
    message: upaiMessage('internal', CUSTOM_PROTOCOL_MESSAGE),
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

  if (!isNil(error)) {
    const normalized = normalizeUpaiError(error)

    return customError({ kind, status, code: normalized.code, message: normalized.message })
  }

  return customError({
    kind,
    status,
    code: 'internal',
    message: upaiMessage('internal', `Upload failed (HTTP ${status})`),
  })
}

function tooLargeResponse(error: UpaiError | null): ProviderError {
  if (error?.details.reason === 'quota') {
    return endpointQuotaError()
  }

  return endpointTooLargeError()
}
