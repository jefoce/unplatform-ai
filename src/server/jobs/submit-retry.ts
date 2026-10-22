import 'server-only'

import { OpenRouterError } from '../openrouter/client'

const PROVIDER_URL_ERROR = /url|download|fetch|image_url|video_url|audio_url/i

interface ShouldRetryAsBase64Params {
  error: unknown
  hasUrlInputs: boolean
  fitsBase64: boolean
}

/** Base64 fallback only for provider URL errors, never network or generic failures. */
export function shouldRetryAsBase64(params: ShouldRetryAsBase64Params): boolean {
  const { error, hasUrlInputs, fitsBase64: canFitBase64 } = params

  if (!hasUrlInputs || !canFitBase64) return false

  if (!(error instanceof OpenRouterError)) return false

  if (error.status !== 400 && error.status !== 422) return false

  return PROVIDER_URL_ERROR.test(error.message)
}
