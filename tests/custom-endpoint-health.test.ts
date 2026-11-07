import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'
import type { ProviderError as ProviderErrorType } from '@/server/providers/provider-error'

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
    getEndpointSync: () => {
      return null
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
  recordHealthFromError,
  recordHealthOk,
  registerEndpointHealthListener,
  setEndpointHealth,
} = await import('@/server/services/endpoint-health')

const { emitCustomHealth } = await import('@/server/providers/custom/health-events')
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

beforeEach(() => {
  resetHealth()
  registerEndpointHealthListener()
})

describe('endpoint health', () => {
  it('reports a removed endpoint on a fresh check', async () => {
    const result = await checkEndpoint('gone')

    expect(result).toEqual({ ok: false, error: 'Endpoint removed' })
  })

  it('maps 401, 403 and a wrong protocol', () => {
    recordHealthFromError('ep1', providerError(401, 'unauthorized'))
    expect(getHealth('ep1')?.state).toBe('unauthorized')

    recordHealthFromError('ep1', providerError(403, 'forbidden'))
    expect(getHealth('ep1')?.state).toBe('forbidden')

    recordHealthFromError('ep1', providerError(0, 'protocol'))
    expect(getHealth('ep1')?.state).toBe('protocol')

    recordHealthFromError('ep1', new TypeError('fetch failed'))
    expect(getHealth('ep1')?.state).toBe('unreachable')
  })

  it('keeps an ok endpoint open after a 400 input error', () => {
    recordHealthOk('ep1')

    recordHealthFromError(
      'ep1',
      new ProviderError({
        providerId: 'custom',
        kind: 'input',
        message: 'bad request',
        storedMessage: 'upai:invalid: bad request',
        status: 400,
        code: 'invalid',
      }),
    )

    expect(getHealth('ep1')?.state).toBe('ok')
  })

  it('clears a failure on a successful poll and keeps the limit', () => {
    recordHealthFromError('ep1', providerError(401, 'unauthorized'))
    recordHealthOk('ep1')

    expect(getHealth('ep1')?.state).toBe('ok')
    expect(getHealth('ep1')?.message).toBeNull()
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
