import 'server-only'

import type { ProviderKindId } from '@/core/providers/types'

export type ProviderErrorKind =
  | 'no_key'
  | 'auth'
  | 'credits'
  | 'not_found'
  | 'rate_limit'
  | 'timeout'
  | 'charged_unknown'
  | 'server'
  | 'url_input'
  | 'input'
  | 'content'
  | 'unknown'

export interface ProviderErrorParams {
  providerId: ProviderKindId
  kind: ProviderErrorKind
  message: string
  storedMessage: string
  status: number
  code: string | null
}

export class ProviderError extends Error {
  constructor(params: ProviderErrorParams) {
    const { providerId, kind, message, storedMessage, status, code } = params

    super(message)
    this.name = 'ProviderError'
    this.providerId = providerId
    this.kind = kind
    this.storedMessage = storedMessage
    this.status = status
    this.code = code
  }

  readonly providerId: ProviderKindId
  readonly kind: ProviderErrorKind
  readonly storedMessage: string
  readonly status: number
  readonly code: string | null
}

/** Stored provider HTTP status, absent for app or network failures. */
export function providerStatusOf(error: unknown): number | undefined {
  if (error instanceof ProviderError) {
    return error.status
  }

  return undefined
}
