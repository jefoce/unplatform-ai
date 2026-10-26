import { describe, expect, it } from 'vitest'

import { OpenRouterError } from '@/server/providers/openrouter/error'
import { classifyOpenRouterError } from '@/server/providers/openrouter/errors'
import { ProviderError, type ProviderErrorKind } from '@/server/providers/provider-error'

interface MappingCase {
  kind: ProviderErrorKind
  message: string
  storedMessage?: string
  status: number
  code?: string
}

const MAPPING_CASES: readonly MappingCase[] = [
  {
    kind: 'no_key',
    message: 'OpenRouter key is not set. Open Settings.',
    storedMessage: 'OpenRouter auth failed',
    status: 401,
    code: 'no_key',
  },
  {
    kind: 'auth',
    message: 'Invalid API key',
    storedMessage: 'OpenRouter auth failed',
    status: 401,
  },
  { kind: 'credits', message: 'Insufficient credits', status: 402 },
  {
    kind: 'not_found',
    message: 'Video not found',
    storedMessage: 'Job not found on OpenRouter',
    status: 404,
  },
  { kind: 'rate_limit', message: 'Too many requests', status: 429 },
  { kind: 'timeout', message: 'Request timed out', status: 408 },
  { kind: 'server', message: 'Bad gateway', status: 502 },
  { kind: 'url_input', message: 'Could not download image_url', status: 400 },
  { kind: 'input', message: 'Bad prompt', status: 422 },
  { kind: 'content', message: 'Image was flagged by moderation', status: 403 },
  { kind: 'unknown', message: 'Teapot', status: 418 },
]

describe('classifyOpenRouterError', () => {
  it.each(MAPPING_CASES)('classifies $kind', (testCase) => {
    const { kind, message, storedMessage, status, code } = testCase

    const error = classifyOpenRouterError(new OpenRouterError({ message, status, code }))

    expect(error).toBeInstanceOf(ProviderError)
    expect(error.providerId).toBe('openrouter')
    expect(error.kind).toBe(kind)
    expect(error.message).toBe(message)
    expect(error.storedMessage).toBe(storedMessage ?? message)
    expect(error.status).toBe(status)
    expect(error.code).toBe(code ?? null)
  })

  it('maps a fetch failure to timeout with status 0', () => {
    const error = new TypeError('fetch failed', { cause: new Error('connect ECONNREFUSED') })

    const mapped = classifyOpenRouterError(error)

    expect(mapped).toBeInstanceOf(ProviderError)
    expect(mapped.providerId).toBe('openrouter')
    expect(mapped.kind).toBe('timeout')
    expect(mapped.message).toBe('fetch failed')
    expect(mapped.storedMessage).toBe('fetch failed')
    expect(mapped.status).toBe(0)
    expect(mapped.code).toBeNull()
  })

  it('rethrows an ordinary error unchanged', () => {
    const error = new Error('boom')
    let caught: unknown

    try {
      classifyOpenRouterError(error)
    } catch (thrown) {
      caught = thrown
    }

    expect(caught).toBe(error)
  })
})
