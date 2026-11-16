import fs from 'node:fs'
import path from 'node:path'

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'

const TOKEN = 'route-token'
const PREVIOUS_TOKEN = process.env.APP_TOKEN
const SRC = path.join(process.cwd(), 'src')

process.env.APP_TOKEN = TOKEN

const { POST } = await import('@/app/api/dev/custom-mock/reachable/route')

const { customMockCatalogForInstance } = await import('@/server/providers/mock/custom-mock')

const {
  __resetMockReachabilityForTests: resetReachability,
  mockReachable,
  setMockReachable,
} = await import('@/server/providers/mock/custom-mock-state')

const {
  __resetEndpointHealthForTests: resetHealth,
  endpointPhase,
  isEndpointVerified,
  recordHealthOk,
} = await import('@/server/services/endpoint-health')

function reachableRequest(body: unknown): Request {
  return new Request('http://127.0.0.1:3000/api/dev/custom-mock/reachable', {
    method: 'POST',
    headers: {
      host: '127.0.0.1:3000',
      cookie: `upai_session=${TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

function sourceFiles(): string[] {
  return fs.readdirSync(SRC, { recursive: true, encoding: 'utf8' }).filter((file) => {
    return file.endsWith('.ts') || file.endsWith('.tsx')
  })
}

beforeEach(() => {
  delete process.env.CUSTOM_ENDPOINT_MOCK
  resetReachability()
  resetHealth()
})

afterEach(() => {
  delete process.env.CUSTOM_ENDPOINT_MOCK
})

describe('custom mock reachable route', () => {
  it('returns 404 unless the custom mock mode is on', async () => {
    const response = await POST(reachableRequest({ id: 'mock-unreachable', isReachable: false }))

    expect(response.status).toBe(404)
    expect(mockReachable('mock-unreachable')).toBeNull()
  })

  it('rejects a body that is not the expected shape', async () => {
    process.env.CUSTOM_ENDPOINT_MOCK = '1'

    const response = await POST(reachableRequest({ id: '' }))

    expect(response.status).toBe(400)
  })

  it('marks the endpoint down and up again', async () => {
    process.env.CUSTOM_ENDPOINT_MOCK = '1'

    const down = await POST(reachableRequest({ id: 'mock-unreachable', isReachable: false }))

    expect(down.status).toBe(204)
    expect(mockReachable('mock-unreachable')).toBe(false)
    expect(customMockCatalogForInstance('mock-unreachable').isReachable).toBe(false)
    expect(endpointPhase('mock-unreachable')).toBe('unreachable')

    const up = await POST(reachableRequest({ id: 'mock-unreachable', isReachable: true }))

    expect(up.status).toBe(204)
    expect(mockReachable('mock-unreachable')).toBe(true)
    expect(customMockCatalogForInstance('mock-unreachable').isReachable).toBe(true)
    expect(isEndpointVerified('mock-unreachable')).toBe(true)
  })

  it('forgets the health result while the mock reports checking', async () => {
    process.env.CUSTOM_ENDPOINT_MOCK = '1'

    recordHealthOk('mock-unreachable')

    const response = await POST(reachableRequest({ id: 'mock-unreachable', isChecking: true }))

    expect(response.status).toBe(204)
    expect(endpointPhase('mock-unreachable')).toBe('checking')
  })
})

describe('custom mock reachability override', () => {
  it('keeps the id suffix when no override is set', () => {
    expect(customMockCatalogForInstance('mock-unreachable').isReachable).toBe(false)
    expect(customMockCatalogForInstance('mock-ready').isReachable).toBe(true)
  })

  it('forces ready or unreachable regardless of the suffix', () => {
    setMockReachable('mock-unreachable', true)
    setMockReachable('mock-ready', false)

    expect(customMockCatalogForInstance('mock-unreachable').isReachable).toBe(true)
    expect(customMockCatalogForInstance('mock-ready').isReachable).toBe(false)
  })
})

describe('custom mock reachability boundary', () => {
  it('keeps the switch on the dev route and the mock provider', () => {
    const importers = sourceFiles()
      .filter((file) => {
        return fs.readFileSync(path.join(SRC, file), 'utf8').includes('custom-mock-state')
      })
      .map((file) => {
        return file.split(path.sep).join('/')
      })

    expect(importers.sort()).toEqual([
      'server/providers/mock/custom-mock.ts',
      'server/services/custom-mock-control.ts',
    ])
  })
})

afterAll(() => {
  if (PREVIOUS_TOKEN === undefined) {
    delete process.env.APP_TOKEN

    return
  }

  process.env.APP_TOKEN = PREVIOUS_TOKEN
})
