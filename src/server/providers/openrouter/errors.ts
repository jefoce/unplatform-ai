import 'server-only'

import { isNil } from 'lodash-es'

import { ProviderError, type ProviderErrorKind } from '../provider-error'
import { OpenRouterError } from './error'

const MODERATION_PATTERN = /moderation|flagged|sensitive|policy/i
const URL_PATTERN = /url|download|fetch|image_url|video_url|audio_url/i

const STATUS_KINDS: Readonly<Record<number, ProviderErrorKind>> = {
  0: 'timeout',
  401: 'auth',
  402: 'credits',
  404: 'not_found',
  408: 'timeout',
  429: 'rate_limit',
}

interface ErrorFields {
  kind: ProviderErrorKind
  message: string
  status: number
  code: string | null
}

const STORED_MESSAGES: Partial<Record<ProviderErrorKind, string>> = {
  auth: 'OpenRouter auth failed',
  no_key: 'OpenRouter auth failed',
  not_found: 'Job not found on OpenRouter',
}

function providerError(params: ErrorFields): ProviderError {
  const storedMessage = STORED_MESSAGES[params.kind] ?? params.message

  return new ProviderError({ providerId: 'openrouter', storedMessage, ...params })
}

function kindFor(error: OpenRouterError): ProviderErrorKind {
  const { status, code, message } = error

  if (code === 'no_key') {
    return 'no_key'
  }

  if (status === 403) {
    if (MODERATION_PATTERN.test(message)) {
      return 'content'
    }

    return 'auth'
  }

  if (status >= 500) {
    return 'server'
  }

  if (status === 400 || status === 422) {
    if (URL_PATTERN.test(message)) {
      return 'url_input'
    }

    return 'input'
  }

  return STATUS_KINDS[status] ?? 'unknown'
}

function isFetchFailure(error: unknown): error is TypeError {
  if (!(error instanceof TypeError)) {
    return false
  }

  return !isNil(error.cause) && error.message === 'fetch failed'
}

export function classifyOpenRouterError(error: unknown): ProviderError {
  if (error instanceof OpenRouterError) {
    return providerError({
      kind: kindFor(error),
      message: error.message,
      status: error.status,
      code: error.code ?? null,
    })
  }

  if (isFetchFailure(error)) {
    return providerError({ kind: 'timeout', message: error.message, status: 0, code: null })
  }

  throw error
}
