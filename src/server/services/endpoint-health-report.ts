import 'server-only'

import type { EndpointHealthStatus } from '@/core/endpoints'

import { getEndpointSync } from '../providers/custom/endpoint-source'
import { networkError } from '../providers/custom/errors'
import { ProviderError } from '../providers/provider-error'

const SHORT_MESSAGE_MAX = 120

interface LogOfflineParams {
  endpointId: string
  kind: string
  message: string
}

export function isTimeoutFailure(error: unknown): boolean {
  if (error instanceof ProviderError) {
    return error.code === 'timeout'
  }

  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
}

export function kindOfError(error: unknown): string {
  if (isTimeoutFailure(error)) {
    return 'timeout'
  }

  if (error instanceof TypeError) {
    return 'network'
  }

  if (error instanceof ProviderError) {
    if (error.code === 'protocol') {
      return 'protocol'
    }

    if (error.status >= 400) {
      return `http ${error.status}`
    }
  }

  return 'network'
}

export function kindOfStatus(status: EndpointHealthStatus): string {
  if (status === 'unauthorized') {
    return 'http 401'
  }

  if (status === 'forbidden') {
    return 'http 403'
  }

  if (status === 'protocol') {
    return 'protocol'
  }

  return 'network'
}

export function errorMessageOf(error: unknown): string {
  if (error instanceof ProviderError) {
    return error.storedMessage
  }

  if (error instanceof TypeError) {
    return networkError(error).storedMessage
  }

  if (error instanceof Error) {
    return error.message
  }

  return ''
}

/** One line, under the length cap, without URLs or tokens. */
export function shortHealthText(text: string): string {
  const withoutPrefix = text.replaceAll(/^upai:[a-z_]+:\s*/gi, '')

  const withoutSecrets = withoutPrefix
    .replaceAll(/https?:\/\/\S+/gi, '')
    .replaceAll(/\bBearer\s+\S+/gi, '')

  const collapsed = withoutSecrets.replaceAll(/\s+/g, ' ').trim()

  if (collapsed === '') {
    return 'ComfyUI is offline'
  }

  return collapsed.slice(0, SHORT_MESSAGE_MAX)
}

/** Short text of a caught value, safe for a record error and a log line. */
export function shortErrorText(error: unknown): string {
  return shortHealthText(errorMessageOf(error))
}

export function logOffline(params: LogOfflineParams): void {
  const { endpointId, kind, message } = params
  const endpoint = getEndpointSync(endpointId)
  const badge = endpoint?.badge ?? endpointId

  console.warn(`[unplatform-ai] endpoint ${badge} unreachable (${kind}): ${message}`)
}
