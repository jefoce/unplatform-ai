import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/server/secrets', () => {
  return {
    getSecret: (name: string) => {
      return name === 'CUSTOM_ENDPOINT_TOKENS' ? JSON.stringify({ ep1: 'secret-token' }) : null
    },
    secretsReady: async () => {},
  }
})

const ROOT = path.join(os.tmpdir(), `cf-custom-endpoints-${process.pid}-${Date.now()}`)
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

const loadSource = () => {
  return import('@/server/providers/custom/endpoint-source')
}

let source: Awaited<ReturnType<typeof loadSource>>

beforeAll(async () => {
  await fs.mkdir(path.join(ROOT, 'data'), { recursive: true })

  await fs.writeFile(
    path.join(ROOT, 'data', 'endpoints.json'),
    JSON.stringify({
      version: 1,
      badgeCounter: 1,
      endpoints: [
        {
          id: 'ep1',
          label: 'Studio',
          badge: 'CU1',
          baseUrl: 'http://127.0.0.1:8188',
          enabled: true,
          pricing: { mode: 'model', usd: 0 },
          instanceId: 'pack-1',
          lastHealth: null,
        },
        {
          id: 'ep2',
          label: 'Laptop',
          badge: 'CU2',
          baseUrl: 'http://127.0.0.1:8189',
          enabled: false,
          pricing: { mode: 'free', usd: 0 },
          instanceId: 'pack-1',
          lastHealth: null,
        },
      ],
    }),
  )

  source = await loadSource()
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT

    return
  }

  process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

describe('custom endpoint source', () => {
  it('reads enabled and disabled endpoints from data/endpoints.json', async () => {
    const endpoints = await source.getEndpoints()

    expect(
      endpoints.map((endpoint) => {
        return endpoint.id
      }),
    ).toEqual(['ep1', 'ep2'])

    expect(source.getEndpointSync('ep1')?.id).toBe('ep1')
    expect((await source.getEndpoint('ep2'))?.id).toBe('ep2')
    expect(source.getEndpointsSync()).toHaveLength(2)
  })

  it('reads the token map by endpoint id and never returns a missing one', () => {
    expect(source.getEndpointToken('ep1')).toBe('secret-token')
    expect(source.getEndpointToken('ep2')).toBeNull()
  })

  it('groups endpoints that report one pack instance', () => {
    const endpoint = source.getEndpointSync('ep2')

    if (endpoint === null) {
      throw new Error('endpoint missing')
    }

    expect(source.endpointQueueKey({ ...endpoint, instanceId: 'pack-1', id: 'ep2' })).toBe('pack-1')
  })
})
