import fs from 'node:fs/promises'
import path from 'node:path'

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import imageFixture from '../docs/protocol/upai-1/fixtures/models-image.json'
import videoFixture from '../docs/protocol/upai-1/fixtures/models-video.json'
import { MAX_JSON_BODY_BYTES } from '../src/core/constants'

const ROOT = vi.hoisted(() => {
  const os = process.getBuiltinModule('node:os')
  const pathModule = process.getBuiltinModule('node:path')
  const root = pathModule.join(os.tmpdir(), `cf-endpoint-test-refresh-${process.pid}`)

  process.env.STORAGE_ROOT = root
  process.env.UPAI_SECRETS_BACKEND = 'file'

  return root
})

const catalog = vi.hoisted(() => {
  return { clearModelCatalog: vi.fn() }
})

const registry = vi.hoisted(() => {
  return { resetCustomProviders: vi.fn() }
})

vi.mock('@/server/services/model-catalog', () => {
  return { clearModelCatalog: catalog.clearModelCatalog }
})

vi.mock('@/server/providers/registry', () => {
  return { resetCustomProviders: registry.resetCustomProviders }
})

const HEALTH = {
  protocol: 1,
  server: 'comfyui',
  server_version: '0.43.0',
  implementation: 'unplatform-ai-provider-node',
  implementation_version: '0.1.0',
  auth_required: false,
  lan_allowed: true,
  max_upload_bytes: 100,
  upload_quota_bytes: 1000,
  instance_id: '11111111-1111-4111-8111-111111111111',
  max_running: 2,
}

const { testEndpoint } = await import('@/server/services/endpoint-test')

const { clearEndpointModelCache, readEndpointModels } =
  await import('@/server/services/endpoint-model-cache')

const { __resetEndpointHealthForTests: resetEndpointHealth, getHealth } =
  await import('@/server/services/endpoint-health')

const {
  __resetEndpointTestsForTests: resetEndpointTests,
  forgetLastTest,
  lastTestFor,
} = await import('@/server/services/endpoint-test')

const { applyEndpointTokens } = await import('@/server/services/endpoint-tokens')

const SAVED_ID = 'ep-refresh'
const UNSAVED_ID = 'ep-unsaved'
const SAVED_URL = 'http://127.0.0.1:8188'

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mockFetch(): string[] {
  const authHeaders: string[] = []

  const mock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const headers = new Headers(init?.headers)

    authHeaders.push(headers.get('Authorization') ?? '')

    if (url.endsWith('/health')) {
      return jsonResponse(HEALTH)
    }

    if (url.endsWith('/videos/models')) {
      return jsonResponse(videoFixture)
    }

    return jsonResponse(imageFixture)
  })

  vi.stubGlobal('fetch', mock)

  return authHeaders
}

beforeEach(async () => {
  resetEndpointHealth()
  resetEndpointTests()
  clearEndpointModelCache()
  await applyEndpointTokens({ changes: [], removedIds: [SAVED_ID, UNSAVED_ID] })
  await fs.rm(ROOT, { recursive: true, force: true })

  await fs.mkdir(path.join(ROOT, 'data'), { recursive: true })

  await fs.writeFile(
    path.join(ROOT, 'data', 'endpoints.json'),
    JSON.stringify({
      version: 1,
      endpoints: [
        { id: SAVED_ID, label: 'Studio', badge: 'CU1', baseUrl: SAVED_URL, enabled: true },
        { id: UNSAVED_ID, label: 'Lab', badge: 'CU2', baseUrl: SAVED_URL, enabled: true },
      ],
      badgeCounter: 0,
    }),
  )

  catalog.clearModelCatalog.mockClear()
  registry.resetCustomProviders.mockClear()
})

afterAll(async () => {
  vi.unstubAllGlobals()
  await fs.rm(ROOT, { recursive: true, force: true })
})

describe('endpoint test refresh', () => {
  it('writes both model caches and clears the catalog', async () => {
    mockFetch()

    const result = await testEndpoint({
      baseUrl: SAVED_URL,
      endpointId: SAVED_ID,
    })

    expect(result.ok).toBe(true)

    const cache = await readEndpointModels(SAVED_ID)

    expect(cache?.video).toHaveLength(videoFixture.data.length)
    expect(cache?.image).toHaveLength(imageFixture.data.length)
    expect(catalog.clearModelCatalog).toHaveBeenCalled()
    expect(registry.resetCustomProviders).toHaveBeenCalled()
  })

  it('returns the draft result when the tested token differs from the saved one', async () => {
    mockFetch()

    const result = await testEndpoint({
      baseUrl: SAVED_URL,
      endpointId: SAVED_ID,
      token: 'different-token',
    })

    expect(result.ok).toBe(true)
    expect(getHealth(SAVED_ID)).toBeNull()
    expect(await readEndpointModels(SAVED_ID)).toBeNull()
    expect(catalog.clearModelCatalog).not.toHaveBeenCalled()
  })

  it('returns the draft result without writing a URL that is not saved', async () => {
    mockFetch()

    const result = await testEndpoint({
      baseUrl: 'http://127.0.0.1:9999',
      endpointId: UNSAVED_ID,
    })

    expect(result.ok).toBe(true)
    expect(getHealth(UNSAVED_ID)).toBeNull()
    expect(await readEndpointModels(UNSAVED_ID)).toBeNull()
    expect(catalog.clearModelCatalog).not.toHaveBeenCalled()
  })

  it('never sends the stored token to an edited URL', async () => {
    await applyEndpointTokens({
      changes: [{ id: SAVED_ID, token: 'stored-token' }],
      removedIds: [],
    })

    const authHeaders = mockFetch()

    await testEndpoint({ baseUrl: 'http://127.0.0.1:9999', endpointId: SAVED_ID })

    expect(authHeaders).toEqual(['', '', ''])
  })

  it('sends the stored token to its saved URL', async () => {
    await applyEndpointTokens({
      changes: [{ id: SAVED_ID, token: 'stored-token' }],
      removedIds: [],
    })

    const authHeaders = mockFetch()

    await testEndpoint({ baseUrl: SAVED_URL, endpointId: SAVED_ID })

    expect(authHeaders).toEqual([
      'Bearer stored-token',
      'Bearer stored-token',
      'Bearer stored-token',
    ])
  })

  it('sends a supplied token to an edited URL', async () => {
    await applyEndpointTokens({
      changes: [{ id: SAVED_ID, token: 'stored-token' }],
      removedIds: [],
    })

    const authHeaders = mockFetch()

    await testEndpoint({
      baseUrl: 'http://127.0.0.1:9999',
      endpointId: SAVED_ID,
      token: 'draft-token',
    })

    expect(authHeaders).toEqual(['Bearer draft-token', 'Bearer draft-token', 'Bearer draft-token'])
  })
})

describe('server-owned test health', () => {
  it('keeps the last successful test per URL and token', async () => {
    mockFetch()

    await testEndpoint({ baseUrl: SAVED_URL, endpointId: SAVED_ID })

    expect(lastTestFor({ baseUrl: SAVED_URL, token: null })).not.toBeNull()
    expect(lastTestFor({ baseUrl: SAVED_URL, token: 'other-token' })).toBeNull()
  })

  it('forgets the cached test after a failed one', async () => {
    mockFetch()
    await testEndpoint({ baseUrl: SAVED_URL, endpointId: SAVED_ID })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
    )

    await testEndpoint({ baseUrl: SAVED_URL, endpointId: SAVED_ID })

    expect(lastTestFor({ baseUrl: SAVED_URL, token: null })).toBeNull()
  })

  it('drops one cached test on demand', async () => {
    mockFetch()
    await testEndpoint({ baseUrl: SAVED_URL, endpointId: SAVED_ID })

    forgetLastTest({ baseUrl: SAVED_URL, token: null })

    expect(lastTestFor({ baseUrl: SAVED_URL, token: null })).toBeNull()
  })
})

describe('endpoint test response cap', () => {
  it('reports an oversized response as a protocol failure', async () => {
    const body = 'a'.repeat(MAX_JSON_BODY_BYTES + 1)

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        if (String(input).endsWith('/health')) {
          return jsonResponse(HEALTH)
        }

        return new Response(body, {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    )

    const result = await testEndpoint({ baseUrl: SAVED_URL, endpointId: SAVED_ID })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('This server does not speak upai/1')
  })
})
