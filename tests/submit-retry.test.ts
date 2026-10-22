import { describe, expect, it, vi } from 'vitest'

import { shouldRetryAsBase64 } from '@/server/jobs/submit-retry'
import { OpenRouterError } from '@/server/openrouter/client'

vi.mock('server-only', () => ({}))

const providerError = (message: string, status: number): OpenRouterError =>
  new OpenRouterError({ message, status })

describe('shouldRetryAsBase64', () => {
  it('retries a 400 provider url error', () => {
    const error = providerError('Failed to download image url', 400)

    expect(shouldRetryAsBase64({ error, hasUrlInputs: true, fitsBase64: true })).toBe(true)
  })

  it('retries a 422 video_url error', () => {
    const error = providerError('video_url is not reachable', 422)

    expect(shouldRetryAsBase64({ error, hasUrlInputs: true, fitsBase64: true })).toBe(true)
  })

  it('does not retry a 500 provider error', () => {
    const error = providerError('url download failed', 500)

    expect(shouldRetryAsBase64({ error, hasUrlInputs: true, fitsBase64: true })).toBe(false)
  })

  it('does not retry a network timeout or fetch failure', () => {
    expect(
      shouldRetryAsBase64({
        error: providerError('fetch failed', 0),
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
    const error = providerError('Failed to download url', 400)

    expect(shouldRetryAsBase64({ error, hasUrlInputs: false, fitsBase64: true })).toBe(false)
    expect(shouldRetryAsBase64({ error, hasUrlInputs: true, fitsBase64: false })).toBe(false)
  })
})
