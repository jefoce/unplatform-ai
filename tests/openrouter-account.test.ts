import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getProviderAccount,
  registerAccountSecretsListener,
} from '@/server/providers/openrouter/account'
import { __setSecretsBackendForTests, setSecrets } from '@/server/secrets'

import { memoryBackend } from './helpers/secrets'

function keyResponse(remaining: number): Response {
  return new Response(JSON.stringify({ data: { limit: 100, limit_remaining: remaining } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function stubFetch(handler: (key: string | null) => Promise<Response>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const key = new Headers(init?.headers).get('Authorization')

      return handler(key)
    }),
  )
}

beforeEach(async () => {
  vi.stubEnv('OPENROUTER_API_KEY', '')
  vi.stubEnv('OPENROUTER_MANAGEMENT_KEY', '')

  registerAccountSecretsListener()
  __setSecretsBackendForTests(memoryBackend({ OPENROUTER_API_KEY: 'key-a' }))
  await setSecrets({ OPENROUTER_API_KEY: 'key-a' })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('getProviderAccount', () => {
  it('keeps the last good numbers with the error when a later load fails', async () => {
    const fetchMock = vi.fn(async () => {
      return keyResponse(10)
    })

    vi.stubGlobal('fetch', fetchMock)

    const first = await getProviderAccount({ fresh: true })

    expect(first).toMatchObject({ keyLimitRemaining: 10, error: null })

    fetchMock.mockRejectedValue(new Error('key endpoint down'))

    const second = await getProviderAccount({ fresh: true })

    expect(second.keyLimitRemaining).toBe(10)
    expect(second.error).toBe('key endpoint down')
  })

  it('drops the old numbers after a secrets change', async () => {
    stubFetch(async () => {
      return keyResponse(10)
    })

    await getProviderAccount({ fresh: true })

    await setSecrets({ OPENROUTER_API_KEY: 'key-b' })

    stubFetch(async () => {
      throw new Error('key endpoint down')
    })

    const next = await getProviderAccount({ fresh: true })

    expect(next).toMatchObject({ source: 'none', error: 'key endpoint down' })
    expect(next.keyLimitRemaining).toBeNull()
  })

  it('ignores a request that settles after the key changed', async () => {
    const started = Promise.withResolvers<void>()
    const gate = Promise.withResolvers<void>()

    stubFetch(async (key) => {
      if (key !== 'Bearer key-a') {
        return keyResponse(222)
      }

      started.resolve()
      await gate.promise

      return keyResponse(111)
    })

    const stale = getProviderAccount({ fresh: true })

    await started.promise
    await setSecrets({ OPENROUTER_API_KEY: 'key-b' })

    const fresh = await getProviderAccount({ fresh: true })

    expect(fresh.keyLimitRemaining).toBe(222)

    gate.resolve()

    const staleResult = await stale

    expect(staleResult.keyLimitRemaining).toBe(111)

    const cached = await getProviderAccount()

    expect(cached.keyLimitRemaining).toBe(222)
  })
})
