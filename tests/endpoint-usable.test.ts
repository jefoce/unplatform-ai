import { beforeEach, describe, expect, it, vi } from 'vitest'

const ENDPOINT_ID = 'ep1'

const endpoints = vi.hoisted(() => {
  return [
    {
      id: 'ep1',
      label: 'ep1',
      badge: 'CU1',
      baseUrl: 'http://127.0.0.1:8188',
      enabled: true,
      pricing: { mode: 'model', usd: 0 },
      instanceId: 'pack-1',
      lastHealth: {
        protocol: 1,
        serverVersion: '0.3.0',
        maxRunning: 4,
        lanAllowed: true,
        authRequired: false,
        maxUploadBytes: 0,
        resultDelete: true,
        checkedAt: '2026-01-01T00:00:00.000Z',
      },
    },
  ]
})

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
    endpointQueueKey: (endpoint: { instanceId: string | null; id: string }) => {
      return endpoint.instanceId ?? endpoint.id
    },
  }
})

const {
  __resetEndpointHealthForTests: resetHealth,
  awaitEndpointUsable,
  getMaxRunning,
  isEndpointUsable,
  probeEnabledEndpoints,
  recordHealthOk,
  setEndpointHealth,
} = await import('@/server/services/endpoint-health')

beforeEach(() => {
  resetHealth()
})

describe('endpoint usability', () => {
  it('stays closed before the first successful check', () => {
    expect(isEndpointUsable(ENDPOINT_ID)).toBe(false)
  })

  it('opens after an ok check', () => {
    recordHealthOk(ENDPOINT_ID)

    expect(isEndpointUsable(ENDPOINT_ID)).toBe(true)
  })

  it('closes on a verified offline state', () => {
    setEndpointHealth({ endpointId: ENDPOINT_ID, status: 'unreachable', message: 'Down' })

    expect(isEndpointUsable(ENDPOINT_ID)).toBe(false)
  })
})

describe('await endpoint usability', () => {
  it('resolves true when the boot probe lands during the wait', async () => {
    setTimeout(() => {
      recordHealthOk(ENDPOINT_ID)
    }, 50)

    await expect(awaitEndpointUsable(ENDPOINT_ID, 1000)).resolves.toBe(true)
  })

  it('resolves false when the endpoint is verified offline', async () => {
    setEndpointHealth({ endpointId: ENDPOINT_ID, status: 'unreachable', message: 'Down' })

    await expect(awaitEndpointUsable(ENDPOINT_ID, 1000)).resolves.toBe(false)
  })
})

describe('mock boot probe', () => {
  it('marks every enabled demo endpoint usable', async () => {
    process.env.CUSTOM_ENDPOINT_MOCK = '1'

    try {
      await probeEnabledEndpoints()

      expect(isEndpointUsable(ENDPOINT_ID)).toBe(true)
    } finally {
      delete process.env.CUSTOM_ENDPOINT_MOCK
    }
  })
})

describe('endpoint limit from memory only', () => {
  it('ignores the stored last health limit', () => {
    expect(endpoints[0]?.lastHealth.maxRunning).toBe(4)
    expect(getMaxRunning('pack-1')).toBe(1)
  })
})
