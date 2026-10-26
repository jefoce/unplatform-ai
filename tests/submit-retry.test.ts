import { describe, expect, it, vi } from 'vitest'

import { shouldRetryAsBase64 } from '@/server/jobs/submit-retry'
import { ProviderError, type ProviderErrorKind } from '@/server/providers/provider-error'

vi.mock('server-only', () => {
  return {}
})

const providerError = (kind: ProviderErrorKind): ProviderError => {
  return new ProviderError({
    providerId: 'openrouter',
    kind,
    message: 'Provider request failed',
    storedMessage: 'Provider request failed',
    status: 400,
    code: null,
  })
}

describe('shouldRetryAsBase64', () => {
  it('retries a provider url error', () => {
    const error = providerError('url_input')

    expect(shouldRetryAsBase64({ error, hasUrlInputs: true, fitsBase64: true })).toBe(true)
  })

  it('does not retry a server error', () => {
    const error = providerError('server')

    expect(shouldRetryAsBase64({ error, hasUrlInputs: true, fitsBase64: true })).toBe(false)
  })

  it('does not retry a timeout', () => {
    expect(
      shouldRetryAsBase64({
        error: providerError('timeout'),
        hasUrlInputs: true,
        fitsBase64: true,
      }),
    ).toBe(false)

    expect(
      shouldRetryAsBase64({
        error: new TypeError('fetch failed'),
        hasUrlInputs: true,
        fitsBase64: true,
      }),
    ).toBe(false)
  })

  it('does not retry non-provider errors', () => {
    expect(
      shouldRetryAsBase64({
        error: new Error('Invalid url input'),
        hasUrlInputs: true,
        fitsBase64: true,
      }),
    ).toBe(false)
  })

  it('does not retry without url inputs or when base64 does not fit', () => {
    const error = providerError('url_input')

    expect(shouldRetryAsBase64({ error, hasUrlInputs: false, fitsBase64: true })).toBe(false)
    expect(shouldRetryAsBase64({ error, hasUrlInputs: true, fitsBase64: false })).toBe(false)
  })
})
