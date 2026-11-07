import fs from 'node:fs/promises'

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import imageFixture from '../docs/protocol/upai-1/fixtures/models-image.json'
import videoFixture from '../docs/protocol/upai-1/fixtures/models-video.json'

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
const { readEndpointModels } = await import('@/server/services/endpoint-model-cache')

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mockFetch(): void {
  const mock = vi.fn(async (input: string | URL | Request) => {
    const url = String(input)

    if (url.endsWith('/health')) {
      return jsonResponse(HEALTH)
    }

    if (url.endsWith('/videos/models')) {
      return jsonResponse(videoFixture)
    }

    return jsonResponse(imageFixture)
  })

  vi.stubGlobal('fetch', mock)
}

beforeEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
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
      baseUrl: 'http://127.0.0.1:8188',
      endpointId: 'ep-refresh',
    })

    expect(result.ok).toBe(true)

    const cache = await readEndpointModels('ep-refresh')

    expect(cache?.video).toHaveLength(videoFixture.data.length)
    expect(cache?.image).toHaveLength(imageFixture.data.length)
    expect(catalog.clearModelCatalog).toHaveBeenCalled()
    expect(registry.resetCustomProviders).toHaveBeenCalled()
  })
})
