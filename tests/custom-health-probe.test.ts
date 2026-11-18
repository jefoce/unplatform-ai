import { afterEach, describe, expect, it, vi } from 'vitest'

import { FETCH_TIMEOUTS } from '@/core/constants'
import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'

import healthFixture from '../docs/protocol/upai-1/fixtures/health.json'

const tokenState = vi.hoisted(() => {
  const state: { value: string | null } = { value: null }

  return state
})

vi.mock('@/server/providers/custom/endpoint-source', () => {
  return {
    getEndpointToken: () => {
      return tokenState.value
    },
  }
})

const { runHealthProbe } = await import('@/server/providers/custom/health')

const { registerCustomHealthListener } = await import('@/server/providers/custom/health-events')

const ENDPOINT: CustomEndpoint = {
  id: 'ep1',
  label: 'ep1',
  badge: 'CU1',
  baseUrl: 'http://127.0.0.1:8188',
  enabled: true,
  pricing: { mode: 'model', usd: 0 },
  instanceId: null,
  lastHealth: null,
}

function healthResponse(): Response {
  return new Response(JSON.stringify(healthFixture), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  tokenState.value = null
})

describe('custom health probe', () => {
  it('runs one probe for concurrent calls on the same origin', async () => {
    const deferred = Promise.withResolvers<Response>()

    const fetchMock = vi.fn<typeof fetch>(() => {
      return deferred.promise
    })

    vi.stubGlobal('fetch', fetchMock)

    const first = runHealthProbe({ ...ENDPOINT, baseUrl: 'http://127.0.0.1:8188/upai' })
    const second = runHealthProbe(ENDPOINT)

    deferred.resolve(healthResponse())

    const [firstProbe, secondProbe] = await Promise.all([first, second])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(secondProbe).toBe(firstProbe)
    expect(firstProbe.ok).toBe(true)
  })

  it('probes the health URL on the endpoint origin without a token', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      return healthResponse()
    })

    vi.stubGlobal('fetch', fetchMock)

    await runHealthProbe({ ...ENDPOINT, baseUrl: 'http://127.0.0.1:8188/upai' })

    const [url, init] = fetchMock.mock.calls[0] ?? []
    const headers = new Headers(init?.headers)

    expect(String(url)).toBe('http://127.0.0.1:8188/upai/api/v1/health')
    expect(new URL(String(url)).host).toBe('127.0.0.1:8188')
    expect(headers.get('authorization')).toBeNull()
  })

  it('sends the endpoint token as a Bearer header', async () => {
    tokenState.value = 'secret-token'

    const fetchMock = vi.fn<typeof fetch>(async () => {
      return healthResponse()
    })

    vi.stubGlobal('fetch', fetchMock)

    await runHealthProbe(ENDPOINT)

    const [url, init] = fetchMock.mock.calls[0] ?? []
    const headers = new Headers(init?.headers)

    expect(String(url)).toBe('http://127.0.0.1:8188/upai/api/v1/health')
    expect(headers.get('authorization')).toBe('Bearer secret-token')
  })

  it('records one unreachable result when the probe never settles', async () => {
    const states: string[] = []

    registerCustomHealthListener((_endpointId, outcome) => {
      states.push(outcome.state)
    })

    const hung = Promise.withResolvers<Response>()

    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => {
        return hung.promise
      }),
    )

    vi.useFakeTimers()

    const pending = runHealthProbe(ENDPOINT)

    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUTS.meta + 2_000)

    const probe = await pending

    if (probe.ok) {
      throw new Error('Expected a failed probe')
    }

    expect(probe.state).toBe('unreachable')
    expect(states).toEqual(['unreachable'])

    hung.resolve(healthResponse())
    await vi.advanceTimersByTimeAsync(0)

    expect(states).toEqual(['unreachable'])
  })
})

describe('custom health probe dedupe by token', () => {
  it('runs one probe for two endpoints on one origin with the same token', async () => {
    tokenState.value = 'shared-token'

    const deferred = Promise.withResolvers<Response>()

    const fetchMock = vi.fn<typeof fetch>(() => {
      return deferred.promise
    })

    vi.stubGlobal('fetch', fetchMock)

    const first = runHealthProbe({ ...ENDPOINT, id: 'ep1' })
    const second = runHealthProbe({ ...ENDPOINT, id: 'ep2' })

    deferred.resolve(healthResponse())

    const [firstProbe, secondProbe] = await Promise.all([first, second])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(secondProbe).toBe(firstProbe)
  })

  it('runs a second probe when the token rotated between calls', async () => {
    tokenState.value = 'old-token'

    const responses: Array<{ resolve: (response: Response) => void }> = []

    const fetchMock = vi.fn<typeof fetch>(() => {
      const deferred = Promise.withResolvers<Response>()

      responses.push(deferred)

      return deferred.promise
    })

    vi.stubGlobal('fetch', fetchMock)

    const first = runHealthProbe(ENDPOINT)

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    tokenState.value = 'new-token'

    const second = runHealthProbe(ENDPOINT)

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    for (const deferred of responses) {
      deferred.resolve(healthResponse())
    }

    await Promise.all([first, second])
  })
})
