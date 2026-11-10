/* eslint-disable max-lines -- health cases share one fixture setup */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { UpaiJobSchema } from '@/core/protocol/upai'
import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'
import type { ProviderError as ProviderErrorType } from '@/server/providers/provider-error'

import jobFailedFixture from '../docs/protocol/upai-1/fixtures/job-failed.json'

const endpoints = vi.hoisted(() => {
  return [endpoint('ep1', 'pack-1'), endpoint('ep2', 'pack-1'), endpoint('ep3', 'pack-2')]
})

function endpoint(id: string, instanceId: string): CustomEndpoint {
  return {
    id,
    label: id,
    badge: 'CU1',
    baseUrl: 'http://127.0.0.1:8188',
    enabled: true,
    pricing: { mode: 'model', usd: 0 },
    instanceId,
    lastHealth: null,
  }
}

vi.mock('@/server/providers/custom/endpoint-source', () => {
  return {
    getEndpoint: async () => {
      return null
    },
    getEndpointsSync: () => {
      return endpoints
    },
    getEndpointSync: (id: string) => {
      return (
        endpoints.find((item) => {
          return item.id === id
        }) ?? null
      )
    },
    getEndpointToken: () => {
      return null
    },
    endpointQueueKey: (target: CustomEndpoint) => {
      return target.instanceId ?? target.id
    },
  }
})

const {
  __resetEndpointHealthForTests: resetHealth,
  checkEndpoint,
  forgetEndpointHealth,
  getHealth,
  getMaxRunning,
  isHealthFresh,
  recordHealthFailure,
  recordHealthFromError,
  recordHealthOk,
  registerEndpointHealthListener,
  setEndpointHealth,
} = await import('@/server/services/endpoint-health')

const { emitCustomHealth } = await import('@/server/providers/custom/health-events')
const { jobFailureError, timeoutError } = await import('@/server/providers/custom/errors')
const { ProviderError } = await import('@/server/providers/provider-error')

function providerError(status: number, code: string): ProviderErrorType {
  return new ProviderError({
    providerId: 'custom',
    kind: 'auth',
    message: 'failed',
    storedMessage: `upai:${code}: failed`,
    status,
    code,
  })
}

interface FailParams {
  endpointId: string
  error: unknown
  source?: 'job' | 'catalog'
  isJobRunning?: boolean
}

function fail(params: FailParams): boolean {
  const { endpointId, error, source = 'catalog', isJobRunning = false } = params

  return recordHealthFromError({ endpointId, error, source, isJobRunning })
}

beforeEach(() => {
  resetHealth()
  registerEndpointHealthListener()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('endpoint health', () => {
  it('reports a removed endpoint on a fresh check', async () => {
    const result = await checkEndpoint('gone')

    expect(result).toEqual({ ok: false, error: 'Endpoint removed' })
  })

  it('maps 401, 403, a wrong protocol and a network failure after two tries', () => {
    const cases = [
      { error: providerError(401, 'unauthorized'), state: 'unauthorized' },
      { error: providerError(403, 'forbidden'), state: 'forbidden' },
      { error: providerError(0, 'protocol'), state: 'protocol' },
      { error: new TypeError('fetch failed'), state: 'unreachable' },
    ]

    for (const item of cases) {
      recordHealthOk('ep1')
      fail({ endpointId: 'ep1', error: item.error })
      expect(getHealth('ep1')?.state).toBe('ok')

      fail({ endpointId: 'ep1', error: item.error })
      expect(getHealth('ep1')?.state).toBe(item.state)
    }
  })

  it('keeps no entry below the threshold', () => {
    fail({ endpointId: 'ep1', error: new TypeError('fetch failed') })

    expect(getHealth('ep1')).toBeNull()
  })

  it('counts a failed probe before closing the endpoint', () => {
    const outcome = {
      state: 'unreachable' as const,
      message: 'Health check failed',
      maxRunning: null,
    }

    emitCustomHealth('ep1', outcome)

    expect(getHealth('ep1')).toBeNull()

    emitCustomHealth('ep1', outcome)

    expect(getHealth('ep1')?.state).toBe('unreachable')
  })

  it('keeps an ok endpoint open after a 400 input error', () => {
    recordHealthOk('ep1')

    fail({
      endpointId: 'ep1',
      error: new ProviderError({
        providerId: 'custom',
        kind: 'input',
        message: 'bad request',
        storedMessage: 'upai:invalid: bad request',
        status: 400,
        code: 'invalid',
      }),
    })

    expect(getHealth('ep1')?.state).toBe('ok')
  })

  it('keeps an ok endpoint open after a job failure or a catalog timeout', () => {
    recordHealthOk('ep1')

    fail({ endpointId: 'ep1', error: jobFailureError(UpaiJobSchema.parse(jobFailedFixture)) })
    fail({ endpointId: 'ep1', error: timeoutError() })

    expect(getHealth('ep1')?.state).toBe('ok')
  })

  it('closes an ok endpoint after two network, unavailable or auth failures', () => {
    const cases = [
      { error: new TypeError('fetch failed'), state: 'unreachable' },
      { error: providerError(0, 'comfy_unavailable'), state: 'unreachable' },
      { error: providerError(401, 'unauthorized'), state: 'unauthorized' },
      { error: providerError(403, 'forbidden'), state: 'forbidden' },
    ]

    for (const item of cases) {
      recordHealthOk('ep1')
      fail({ endpointId: 'ep1', error: item.error })
      fail({ endpointId: 'ep1', error: item.error })

      expect(getHealth('ep1')?.state).toBe(item.state)
    }
  })
})

describe('endpoint health counts', () => {
  it('needs a third failure while a job runs', () => {
    recordHealthOk('ep1')

    fail({ endpointId: 'ep1', error: new TypeError('fetch failed'), isJobRunning: true })
    fail({ endpointId: 'ep1', error: new TypeError('fetch failed'), isJobRunning: true })

    expect(getHealth('ep1')?.state).toBe('ok')

    fail({ endpointId: 'ep1', error: new TypeError('fetch failed'), isJobRunning: true })

    expect(getHealth('ep1')?.state).toBe('unreachable')
  })

  it('resets the count after a success', () => {
    fail({ endpointId: 'ep1', error: new TypeError('fetch failed') })
    recordHealthOk('ep1')
    fail({ endpointId: 'ep1', error: new TypeError('fetch failed') })

    expect(getHealth('ep1')?.state).toBe('ok')
  })
})

describe('endpoint health timeouts', () => {
  it('counts a timeout for a job poll but never for a catalog fetch', () => {
    recordHealthOk('ep1')
    fail({ endpointId: 'ep1', error: timeoutError() })
    fail({ endpointId: 'ep1', error: timeoutError() })

    expect(getHealth('ep1')?.state).toBe('ok')

    recordHealthOk('ep2')
    fail({ endpointId: 'ep2', error: timeoutError(), source: 'job' })
    fail({ endpointId: 'ep2', error: timeoutError(), source: 'job' })

    expect(getHealth('ep2')?.state).toBe('unreachable')
  })
})

describe('endpoint health reports', () => {
  it('logs once at the transition and hides the URL and token', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const error = new ProviderError({
      providerId: 'custom',
      kind: 'server',
      message: 'failed',
      storedMessage:
        'upai:comfy_unavailable: fetch https://127.0.0.1:8188/jobs?token=SECRET failed Bearer SECRET',
      status: 0,
      code: 'comfy_unavailable',
    })

    fail({ endpointId: 'ep1', error })
    fail({ endpointId: 'ep1', error })
    fail({ endpointId: 'ep1', error })

    expect(warn).toHaveBeenCalledTimes(1)

    const line = String(warn.mock.calls[0]?.[0])

    expect(line).toBe('[unplatform-ai] endpoint CU1 unreachable (network): fetch failed')
    expect(line).not.toContain('https')
    expect(line).not.toContain('SECRET')
  })

  it('applies the same threshold to a ready failure status', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    recordHealthFailure({ endpointId: 'ep1', status: 'unauthorized', message: 'Token rejected' })

    expect(getHealth('ep1')).toBeNull()

    recordHealthFailure({ endpointId: 'ep1', status: 'unauthorized', message: 'Token rejected' })

    expect(getHealth('ep1')?.state).toBe('unauthorized')

    expect(String(warn.mock.calls[0]?.[0])).toBe(
      '[unplatform-ai] endpoint CU1 unreachable (http 401): Token rejected',
    )
  })

  it('clears a failure on a successful poll and keeps the limit', () => {
    fail({ endpointId: 'ep1', error: providerError(401, 'unauthorized') })
    fail({ endpointId: 'ep1', error: providerError(401, 'unauthorized') })
    recordHealthOk('ep1', 4)

    expect(getHealth('ep1')?.state).toBe('ok')
    expect(getHealth('ep1')?.message).toBeNull()
    expect(getMaxRunning('pack-1')).toBe(4)
  })

  it('keeps the last limit through an ok without one', () => {
    setEndpointHealth({ endpointId: 'ep1', status: 'ok', message: null, maxRunning: 3 })
    recordHealthOk('ep1')

    expect(getMaxRunning('pack-1')).toBe(3)
  })

  it('treats a state older than the max age as stale', () => {
    const fresh = { state: 'ok' as const, checkedAt: new Date().toISOString(), message: null }
    const stale = { state: 'ok' as const, checkedAt: new Date(0).toISOString(), message: null }

    expect(isHealthFresh(fresh)).toBe(true)
    expect(isHealthFresh(stale)).toBe(false)
  })

  it('sets a manual entry with its limit and forgets it', () => {
    setEndpointHealth({ endpointId: 'ep1', status: 'ok', message: 'ready', maxRunning: 3 })

    expect(getHealth('ep1')).toMatchObject({ state: 'ok', message: 'ready' })
    expect(getMaxRunning('pack-1')).toBe(3)

    forgetEndpointHealth('ep1')

    expect(getHealth('ep1')).toBeNull()
  })

  it('shares one limit for endpoints on the same pack instance', () => {
    emit('ep1', 3)
    emit('ep2', 2)

    expect(getMaxRunning('pack-1')).toBe(2)
    expect(getMaxRunning('pack-2')).toBe(1)
  })
})

function emit(endpointId: string, maxRunning: number): void {
  emitCustomHealth(endpointId, { state: 'ok', message: null, maxRunning })
}
