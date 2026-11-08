import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

/* eslint-disable max-lines -- one service suite covers tokens, health and test mapping */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { ENDPOINT_HEALTH_MAX_AGE_MS } from '@/core/constants'
import type * as EndpointsRepo from '@/server/repos/endpoints'
import type * as EndpointOverviewService from '@/server/services/endpoint-overview'
import type * as EndpointSaveService from '@/server/services/endpoint-save'
import type * as EndpointTestService from '@/server/services/endpoint-test'

import { storedRecord } from './helpers/stored-record'

const ROOT = path.join(os.tmpdir(), `cf-endpoints-service-${process.pid}-${Date.now()}`)
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

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

const LAST_HEALTH = {
  protocol: 1,
  serverVersion: '0.43.0',
  maxRunning: 2,
  lanAllowed: true,
  authRequired: false,
  maxUploadBytes: 100,
  checkedAt: '2024-01-01T00:00:00.000Z',
}

async function loadSecrets() {
  return import('@/server/secrets')
}

type SecretsPromise = ReturnType<typeof loadSecrets>

type SecretsModule = Awaited<SecretsPromise>

let service: typeof EndpointSaveService
let overviewService: typeof EndpointOverviewService
let testService: typeof EndpointTestService
let repo: typeof EndpointsRepo
let secrets: SecretsModule

beforeAll(async () => {
  secrets = await loadSecrets()
  secrets.__setSecretsBackendForTests((await import('./helpers/secrets')).memoryBackend())
  await secrets.secretsReady()

  service = await import('@/server/services/endpoint-save')
  overviewService = await import('@/server/services/endpoint-overview')
  testService = await import('@/server/services/endpoint-test')
  repo = await import('@/server/repos/endpoints')
})

beforeEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(path.join(ROOT, 'data'), { recursive: true })
  await secrets.setSecrets({ CUSTOM_ENDPOINT_TOKENS: null })

  const health = await import('@/server/services/endpoint-health')

  health.__resetEndpointHealthForTests()
  testService.__resetEndpointTestsForTests()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT

    return
  }

  process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

function endpoint(label: string, token?: string): EndpointSaveService.EndpointInput {
  return {
    id: null,
    label,
    badge: null,
    baseUrl: 'http://127.0.0.1:8188',
    enabled: true,
    pricing: { mode: 'model', usd: 0 },
    instanceId: null,
    lastHealth: null,
    token,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mockHealthyFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      if (String(input).endsWith('/health')) {
        return jsonResponse(HEALTH)
      }

      return jsonResponse({ data: [] })
    }),
  )
}

describe('token storage', () => {
  it('rejects a token map over the secret limit without saving tokens', async () => {
    const endpoints = Array.from({ length: 50 }, (_, index) => {
      return endpoint(`Endpoint ${index}`, 'x'.repeat(100))
    })

    await expect(service.saveEndpoints({ endpoints })).rejects.toMatchObject({
      status: 400,
      message: 'Too many endpoint tokens',
    })

    const tokens = await import('@/server/services/endpoint-tokens')

    expect(tokens.readTokenMap()).toEqual({})
  })

  it('stores a token, shows the last four and removes it with the endpoint', async () => {
    const saved = await service.saveEndpoints({ endpoints: [endpoint('Studio', 'abcd1234')] })
    const entry = saved.endpoints[0]

    expect(entry).toBeDefined()
    expect(entry?.tokenHint).toBe('1234')
    expect(entry?.hasToken).toBe(true)

    expect(
      (await import('@/server/services/endpoint-tokens')).readEndpointToken(entry?.id ?? ''),
    ).toBe('abcd1234')

    const cacheFile = repo.endpointModelsFile(entry?.id ?? '')

    await fs.mkdir(path.dirname(cacheFile), { recursive: true })
    await fs.writeFile(cacheFile, JSON.stringify({ video: [{}], image: [{}, {}] }))
    await service.saveEndpoints({ endpoints: [] })

    expect(
      (await import('@/server/services/endpoint-tokens')).readEndpointToken(entry?.id ?? ''),
    ).toBeNull()

    await expect(fs.stat(cacheFile)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})

describe('token readiness', () => {
  it('loads the stored map before saving one token', async () => {
    const backend = (await import('./helpers/secrets')).memoryBackend({
      CUSTOM_ENDPOINT_TOKENS: JSON.stringify({ keep: 'keep-token' }),
    })

    secrets.__setSecretsBackendForTests(backend)

    const tokens = await import('@/server/services/endpoint-tokens')

    await tokens.applyEndpointTokens({
      changes: [{ id: 'new', token: 'new-token' }],
      removedIds: [],
    })

    expect(tokens.readTokenMap()).toEqual({ keep: 'keep-token', new: 'new-token' })
  })
})

describe('running jobs', () => {
  it('counts active records per endpoint', async () => {
    const saved = await repo.applyEndpoints({
      entries: [
        {
          label: 'Studio',
          baseUrl: 'http://127.0.0.1:8188',
          enabled: true,
          pricing: { mode: 'model', usd: 0 },
          instanceId: null,
          lastHealth: null,
        },
      ],
    })

    const id = saved.file.endpoints[0]?.id ?? ''
    const recordId = '66666666-6666-4666-8666-666666666666'

    const record = storedRecord(recordId, {
      status: 'in_progress',
      preset: { id: `custom.${id}.wan`, title: 'Wan', slug: 'wan' },
    })

    const downloads = path.join(ROOT, 'downloads')

    await fs.mkdir(downloads, { recursive: true })
    await fs.writeFile(path.join(downloads, `${recordId}.json`), JSON.stringify(record))

    const future = new Date(Date.now() + 5000)

    await fs.utimes(downloads, future, future)

    const overview = await overviewService.getEndpointOverview()

    expect(overview.endpoints[0]?.runningJobs).toBe(1)
    expect(overview.endpoints[0]?.status).toBe('unknown')

    const health = await import('@/server/services/endpoint-health')

    health.setEndpointHealth({ endpointId: id, status: 'unauthorized', message: null })

    expect((await overviewService.getEndpointOverview()).endpoints[0]?.status).toBe('unauthorized')
  })
})

describe('health freshness', () => {
  it('ignores a stale entry and keeps the saved last health', async () => {
    mockHealthyFetch()
    await testService.testEndpoint({ baseUrl: endpoint('Studio').baseUrl, endpointId: null })

    const saved = await service.saveEndpoints({ endpoints: [endpoint('Studio')] })
    const id = saved.endpoints[0]?.id ?? ''
    const health = await import('@/server/services/endpoint-health')
    const now = Date.now()

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(now)
    health.setEndpointHealth({ endpointId: id, status: 'unreachable', message: null })
    vi.setSystemTime(now + ENDPOINT_HEALTH_MAX_AGE_MS + 1000)

    try {
      const overview = await overviewService.getEndpointOverview()

      expect(overview.endpoints[0]?.status).toBe('ok')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('endpoint edits', () => {
  it('clears health and last health when the base URL changes', async () => {
    const saved = await service.saveEndpoints({ endpoints: [endpoint('Studio')] })
    const id = saved.endpoints[0]?.id ?? ''
    const health = await import('@/server/services/endpoint-health')

    mockHealthyFetch()
    await testService.testEndpoint({ baseUrl: endpoint('Studio').baseUrl, endpointId: id })

    health.setEndpointHealth({ endpointId: id, status: 'unreachable', message: null })

    expect((await overviewService.getEndpointOverview()).endpoints[0]?.status).toBe('unreachable')

    const cacheFile = repo.endpointModelsFile(id)

    await fs.mkdir(path.dirname(cacheFile), { recursive: true })
    await fs.writeFile(cacheFile, JSON.stringify({ video: [{}], image: [{}, {}] }))

    const next = await service.saveEndpoints({
      endpoints: [
        {
          ...endpoint('Studio'),
          id,
          baseUrl: 'http://127.0.0.1:9999',
          lastHealth: LAST_HEALTH,
        },
      ],
    })

    expect(next.endpoints[0]?.lastHealth).toBeNull()
    expect(next.endpoints[0]?.status).toBe('unknown')
    expect(health.getHealth(id)).toBeNull()
    await expect(fs.stat(cacheFile)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('drops the server test when the token changes without a new test', async () => {
    const saved = await service.saveEndpoints({ endpoints: [endpoint('Studio')] })
    const id = saved.endpoints[0]?.id ?? ''

    mockHealthyFetch()
    await testService.testEndpoint({ baseUrl: endpoint('Studio').baseUrl, endpointId: id })

    const next = await service.saveEndpoints({
      endpoints: [{ ...endpoint('Studio', 'new-token'), id, lastHealth: LAST_HEALTH }],
    })

    expect(next.endpoints[0]?.lastHealth).toBeNull()
    expect(next.endpoints[0]?.status).toBe('unknown')
  })
})

describe('fresh test on save', () => {
  it('writes tested health and drops the cache when the URL changed after a fresh test', async () => {
    const saved = await service.saveEndpoints({ endpoints: [endpoint('Studio')] })
    const id = saved.endpoints[0]?.id ?? ''
    const health = await import('@/server/services/endpoint-health')
    const cacheFile = repo.endpointModelsFile(id)

    await fs.mkdir(path.dirname(cacheFile), { recursive: true })
    await fs.writeFile(cacheFile, JSON.stringify({ video: [{}], image: [{}, {}] }))

    mockHealthyFetch()

    const tested = await testService.testEndpoint({
      baseUrl: 'http://127.0.0.1:9999',
      endpointId: id,
    })

    const next = await service.saveEndpoints({
      endpoints: [
        {
          ...endpoint('Studio'),
          id,
          baseUrl: 'http://127.0.0.1:9999',
          lastHealth: LAST_HEALTH,
        },
      ],
    })

    expect(next.endpoints[0]?.lastHealth).toEqual(tested.lastHealth)
    expect(health.getHealth(id)).toMatchObject({ state: 'ok', message: null })
    await expect(fs.stat(cacheFile)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('keeps health and cache when only enabled changed after a fresh test', async () => {
    const saved = await service.saveEndpoints({ endpoints: [endpoint('Studio')] })
    const id = saved.endpoints[0]?.id ?? ''
    const health = await import('@/server/services/endpoint-health')
    const cacheFile = repo.endpointModelsFile(id)

    await fs.mkdir(path.dirname(cacheFile), { recursive: true })
    await fs.writeFile(cacheFile, JSON.stringify({ video: [{}], image: [{}, {}] }))

    mockHealthyFetch()

    const tested = await testService.testEndpoint({
      baseUrl: endpoint('Studio').baseUrl,
      endpointId: id,
    })

    const next = await service.saveEndpoints({
      endpoints: [{ ...endpoint('Studio'), id, enabled: false, lastHealth: LAST_HEALTH }],
    })

    expect(next.endpoints[0]?.lastHealth).toEqual(tested.lastHealth)
    expect(health.getHealth(id)?.state).toBe('ok')
    await expect(fs.stat(cacheFile)).resolves.toBeDefined()
  })

  it('ignores a forged client last health for the same URL and token', async () => {
    const saved = await service.saveEndpoints({ endpoints: [endpoint('Studio')] })
    const id = saved.endpoints[0]?.id ?? ''

    mockHealthyFetch()

    const tested = await testService.testEndpoint({
      baseUrl: endpoint('Studio').baseUrl,
      endpointId: id,
    })

    const forged = { ...LAST_HEALTH, maxRunning: 8, checkedAt: '2099-01-01T00:00:00.000Z' }

    const next = await service.saveEndpoints({
      endpoints: [{ ...endpoint('Studio'), id, lastHealth: forged }],
    })

    expect(next.endpoints[0]?.lastHealth).toEqual(tested.lastHealth)
    expect(next.endpoints[0]?.lastHealth?.maxRunning).toBe(HEALTH.max_running)
  })
})

describe('fresh test keeps state', () => {
  it('keeps a fresh test when the endpoint was edited before Save', async () => {
    const saved = await service.saveEndpoints({ endpoints: [endpoint('Studio')] })
    const id = saved.endpoints[0]?.id ?? ''
    const health = await import('@/server/services/endpoint-health')

    mockHealthyFetch()

    const tested = await testService.testEndpoint({
      baseUrl: 'http://127.0.0.1:9999',
      endpointId: id,
    })

    const next = await service.saveEndpoints({
      endpoints: [
        {
          ...endpoint('Studio'),
          id,
          baseUrl: 'http://127.0.0.1:9999',
          lastHealth: LAST_HEALTH,
        },
      ],
    })

    expect(next.endpoints[0]?.lastHealth).toEqual(tested.lastHealth)
    expect(next.endpoints[0]?.status).toBe('ok')
    expect(health.getHealth(id)).not.toBeNull()
  })

  it('keeps health after a test when only the instance id changes', async () => {
    const saved = await repo.applyEndpoints({
      entries: [
        {
          label: 'Studio',
          baseUrl: endpoint('Studio').baseUrl,
          enabled: true,
          pricing: { mode: 'model', usd: 0 },
          instanceId: null,
          lastHealth: LAST_HEALTH,
        },
      ],
    })

    const id = saved.file.endpoints[0]?.id ?? ''
    const health = await import('@/server/services/endpoint-health')

    health.setEndpointHealth({ endpointId: id, status: 'ok', message: null })

    const next = await service.saveEndpoints({
      endpoints: [
        {
          ...endpoint('Studio'),
          id,
          instanceId: HEALTH.instance_id,
          lastHealth: LAST_HEALTH,
        },
      ],
    })

    expect(next.endpoints[0]?.lastHealth).toEqual(LAST_HEALTH)
    expect(next.endpoints[0]?.status).toBe('ok')
    expect(health.getHealth(id)).not.toBeNull()
  })

  it('keeps a draft test for a new endpoint saved with the same URL and token', async () => {
    mockHealthyFetch()

    const tested = await testService.testEndpoint({
      baseUrl: endpoint('Studio').baseUrl,
      endpointId: null,
      token: 'draft-token',
    })

    const saved = await service.saveEndpoints({ endpoints: [endpoint('Studio', 'draft-token')] })

    expect(saved.endpoints[0]?.lastHealth).toEqual(tested.lastHealth)
    expect(saved.endpoints[0]?.status).toBe('ok')
  })

  it('drops a draft test for a new endpoint saved with a different token', async () => {
    mockHealthyFetch()

    await testService.testEndpoint({
      baseUrl: endpoint('Studio').baseUrl,
      endpointId: null,
      token: 'draft-token',
    })

    const saved = await service.saveEndpoints({ endpoints: [endpoint('Studio', 'other-token')] })

    expect(saved.endpoints[0]?.lastHealth).toBeNull()
    expect(saved.endpoints[0]?.status).toBe('unknown')
  })
})

describe('endpoint test mapping', () => {
  const params = { baseUrl: 'http://127.0.0.1:8188/upai', endpointId: null }

  it('reads health and both model lists', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)

      if (url.endsWith('/health')) {
        return jsonResponse(HEALTH)
      }

      return jsonResponse({ data: [] })
    })

    vi.stubGlobal('fetch', fetchMock)

    const result = await testService.testEndpoint(params)

    expect(result).toMatchObject({
      ok: true,
      error: null,
      serverVersion: '0.43.0',
      videoCount: 0,
      imageCount: 0,
      authRequired: false,
      lanAllowed: true,
      instanceId: HEALTH.instance_id,
    })

    expect(result.lastHealth?.maxUploadBytes).toBe(HEALTH.max_upload_bytes)

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8188/upai/api/v1/health',
      expect.objectContaining({ redirect: 'error' }),
    )
  })

  it('maps 401 to a token message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(null, { status: 401 })
      }),
    )

    await expect(testService.testEndpoint(params)).resolves.toMatchObject({
      ok: false,
      error: 'Token needed or wrong',
    })
  })

  it('maps 403 to the LAN message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(null, { status: 403 })
      }),
    )

    await expect(testService.testEndpoint(params)).resolves.toMatchObject({
      ok: false,
      error:
        'This computer cannot reach ComfyUI: enable LAN access in ComfyUI Settings > Unplatform AI, or add a token',
    })
  })

  it('maps a refused connection to the start message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
    )

    await expect(testService.testEndpoint(params)).resolves.toMatchObject({
      ok: false,
      error: 'Start ComfyUI, then test again',
    })
  })

  it('maps a different protocol to the upai message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return jsonResponse({ protocol: 2 })
      }),
    )

    await expect(testService.testEndpoint(params)).resolves.toMatchObject({
      ok: false,
      error: 'This server does not speak upai/1',
    })
  })
})
