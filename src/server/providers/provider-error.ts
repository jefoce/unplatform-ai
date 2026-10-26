import 'server-only'

import type { VideoProviderId } from '@/core/providers/types'

export type ProviderErrorKind =
  | 'no_key'
  | 'auth'
  | 'credits'
  | 'not_found'
  | 'rate_limit'
  | 'timeout'
  | 'server'
  | 'url_input'
  | 'input'
  | 'content'
  | 'unknown'

export interface ProviderErrorParams {
  providerId: VideoProviderId
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

  readonly providerId: VideoProviderId
  readonly kind: ProviderErrorKind
  readonly storedMessage: string
  readonly status: number
  readonly code: string | null
}
