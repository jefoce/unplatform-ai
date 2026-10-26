import 'server-only'

import { ProviderError } from '../providers/provider-error'

interface ShouldRetryAsBase64Params {
  error: unknown
  hasUrlInputs: boolean
  fitsBase64: boolean
}

/** Base64 fallback only for provider URL errors, never network or generic failures. */
export function shouldRetryAsBase64(params: ShouldRetryAsBase64Params): boolean {
  const { error, hasUrlInputs, fitsBase64: canFitBase64 } = params

  if (!hasUrlInputs || !canFitBase64) {
    return false
  }

  return error instanceof ProviderError && error.kind === 'url_input'
}
