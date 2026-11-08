import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { EndpointInput, EndpointOverviewEntry } from '@/core/api/endpoints'
import type * as EndpointsRepo from '@/server/repos/endpoints'
import type * as EndpointSaveService from '@/server/services/endpoint-save'
import type * as EndpointTestService from '@/server/services/endpoint-test'

const ROOT = path.join(os.tmpdir(), `cf-endpoints-cache-${process.pid}-${Date.now()}`)
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

const LAST_HEALTH = {
  protocol: 1,
  serverVersion: '0.43.0',
  maxRunning: 2,
  lanAllowed: true,
  authRequired: false,
  maxUploadBytes: 100,
  checkedAt: '2024-01-01T00:00:00.000Z',
}

process.env.STORAGE_ROOT = ROOT

let service: typeof EndpointSaveService
let repo: typeof EndpointsRepo
let testService: typeof EndpointTestService

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

function endpoint(): EndpointInput {
  return {
    id: null,
    label: 'Studio',
    badge: null,
    baseUrl: 'http://127.0.0.1:8188',
    enabled: true,
    pricing: { mode: 'model', usd: 0 },
    instanceId: null,
    lastHealth: null,
  }
}

function endpointInput(entry: EndpointOverviewEntry): EndpointInput {
  return {
    id: entry.id,
    label: entry.label,
    badge: entry.badge,
    baseUrl: entry.baseUrl,
    enabled: entry.enabled,
    pricing: entry.pricing,
    instanceId: entry.instanceId,
    lastHealth: entry.lastHealth,
  }
}

async function saveStudio(): Promise<EndpointOverviewEntry> {
  const saved = await service.saveEndpoints({ endpoints: [endpoint()] })
  const entry = saved.endpoints[0]

  if (!entry) {
    throw new Error('Missing saved endpoint')
  }

  return entry
}

async function writeCache(id: string): Promise<string> {
  const cacheFile = repo.endpointModelsFile(id)

  await fs.mkdir(path.dirname(cacheFile), { recursive: true })
  await fs.writeFile(cacheFile, JSON.stringify({ video: [{}], image: [{}, {}] }))

  return cacheFile
}

function mockHealthyFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const body = String(input).endsWith('/health') ? HEALTH : { data: [] }

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
}

beforeAll(async () => {
  const secrets = await import('@/server/secrets')

  secrets.__setSecretsBackendForTests((await import('./helpers/secrets')).memoryBackend())
  await secrets.secretsReady()

  service = await import('@/server/services/endpoint-save')
  repo = await import('@/server/repos/endpoints')
  testService = await import('@/server/services/endpoint-test')
})

beforeEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(path.join(ROOT, 'data'), { recursive: true })

  const secrets = await import('@/server/secrets')
  const health = await import('@/server/services/endpoint-health')

  await secrets.setSecrets({ CUSTOM_ENDPOINT_TOKENS: null })

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

describe('endpoint cache refresh', () => {
  it('keeps the cache file and counts for an unchanged endpoint', async () => {
    const entry = await saveStudio()
    const cacheFile = await writeCache(entry.id)

    const saved = await service.saveEndpoints({ endpoints: [endpointInput(entry)] })

    await expect(fs.stat(cacheFile)).resolves.toBeDefined()
    expect(saved.endpoints[0]?.videoCount).toBe(1)
    expect(saved.endpoints[0]?.imageCount).toBe(2)
  })

  it('removes the cache file when the base URL changes', async () => {
    const entry = await saveStudio()
    const cacheFile = await writeCache(entry.id)

    await service.saveEndpoints({
      endpoints: [{ ...endpointInput(entry), baseUrl: 'http://127.0.0.1:9999' }],
    })

    await expect(fs.stat(cacheFile)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('removes the cache file when a token changes', async () => {
    const entry = await saveStudio()
    const cacheFile = await writeCache(entry.id)

    await service.saveEndpoints({ endpoints: [{ ...endpointInput(entry), token: 'abcd1234' }] })

    await expect(fs.stat(cacheFile)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('keeps the cache file when a fresh test covers an enabled change', async () => {
    const entry = await saveStudio()
    const cacheFile = await writeCache(entry.id)

    mockHealthyFetch()
    await testService.testEndpoint({ baseUrl: entry.baseUrl, endpointId: entry.id })

    await service.saveEndpoints({
      endpoints: [
        {
          ...endpointInput(entry),
          enabled: false,
          lastHealth: { ...LAST_HEALTH, checkedAt: '2024-06-01T00:00:00.000Z' },
        },
      ],
    })

    await expect(fs.stat(cacheFile)).resolves.toBeDefined()
  })

  it('removes the cache file when enabled changes without a fresh test', async () => {
    const entry = await saveStudio()
    const cacheFile = await writeCache(entry.id)

    await service.saveEndpoints({
      endpoints: [{ ...endpointInput(entry), enabled: false }],
    })

    await expect(fs.stat(cacheFile)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('removes the cache file when a fresh test still changes the base URL', async () => {
    const entry = await saveStudio()
    const cacheFile = await writeCache(entry.id)

    mockHealthyFetch()

    await testService.testEndpoint({
      baseUrl: 'http://127.0.0.1:9999',
      endpointId: entry.id,
    })

    await service.saveEndpoints({
      endpoints: [
        {
          ...endpointInput(entry),
          baseUrl: 'http://127.0.0.1:9999',
          lastHealth: { ...LAST_HEALTH, checkedAt: '2024-06-01T00:00:00.000Z' },
        },
      ],
    })

    await expect(fs.stat(cacheFile)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('has no cache file for a new endpoint', async () => {
    const entry = await saveStudio()

    await expect(fs.stat(repo.endpointModelsFile(entry.id))).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  it('removes the cache file of a deleted endpoint', async () => {
    const entry = await saveStudio()
    const cacheFile = await writeCache(entry.id)

    await service.saveEndpoints({ endpoints: [] })

    await expect(fs.stat(cacheFile)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
