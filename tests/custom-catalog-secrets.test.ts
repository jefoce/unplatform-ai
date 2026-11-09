import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import imageFixture from '../docs/protocol/upai-1/fixtures/models-image.json'
import videoFixture from '../docs/protocol/upai-1/fixtures/models-video.json'
import { UpaiModelListSchema } from '../src/core/protocol/upai'
import { memoryBackend } from './helpers/secrets'

vi.mock('@/server/session', () => {
  return {
    hasSession: () => {
      return true
    },
  }
})

vi.mock('@/server/providers/registry', () => {
  const provider = {
    getPricing: async () => {
      return { skus: {}, listSkus: {}, discount: 0, source: 'fallback', fetchedAt: '' }
    },
    isConfigured: () => {
      return false
    },
  }

  return {
    getVideoProvider: () => {
      return provider
    },
    getImageProvider: () => {
      return provider
    },
  }
})

vi.mock('@/core/providers/registry', () => {
  return {
    providerDescriptor: (id: string) => {
      return { id, label: 'OpenRouter' }
    },
  }
})

const ROOT = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-custom-catalog-secrets-'))
const DATA_DIR = path.join(ROOT, 'data')
const ENDPOINT_ID = 'ep-secret'
const TOKEN = 'saved-token'

vi.stubEnv('STORAGE_ROOT', ROOT)
vi.stubEnv('CUSTOM_ENDPOINT_MOCK', '')

await fs.mkdir(DATA_DIR, { recursive: true })

await fs.writeFile(
  path.join(DATA_DIR, 'endpoints.json'),
  JSON.stringify({
    version: 1,
    badgeCounter: 1,
    endpoints: [
      {
        id: ENDPOINT_ID,
        label: 'Studio',
        badge: 'CU1',
        baseUrl: 'http://127.0.0.1:8188',
        enabled: true,
        pricing: { mode: 'model', usd: 0 },
        instanceId: null,
        lastHealth: null,
      },
    ],
  }),
)

const VIDEO_MODELS = UpaiModelListSchema.parse(videoFixture).data
const IMAGE_MODELS = UpaiModelListSchema.parse(imageFixture).data

const RouteBodySchema = z.object({
  entries: z.array(
    z
      .object({
        modelId: z.string(),
        presetId: z.string(),
      })
      .loose(),
  ),
})

const { GET } = await import('@/app/api/models/route')
const { clearModelCatalog } = await import('@/server/services/model-catalog')
const secrets = await import('@/server/secrets')

function catalogRequest(): Request {
  return new Request('http://127.0.0.1:3000/api/models', {
    headers: { host: '127.0.0.1:3000' },
  })
}

function modelResponse(isVideo: boolean): Response {
  const body = isVideo ? videoFixture : imageFixture

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

afterAll(async () => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  await fs.rm(ROOT, { recursive: true, force: true })
})

describe('custom catalog secrets readiness', () => {
  it('waits for a delayed secrets load before the first model request', async () => {
    const gate = Promise.withResolvers<void>()

    const backend = memoryBackend({
      CUSTOM_ENDPOINT_TOKENS: JSON.stringify({ [ENDPOINT_ID]: TOKEN }),
    })

    const getAll = backend.getAll

    backend.getAll = async () => {
      await gate.promise

      return getAll()
    }

    secrets.__resetSecretsForTests()
    secrets.__setSecretsBackendForTests(backend)
    clearModelCatalog()

    const fetchMock = vi.fn<typeof fetch>()

    fetchMock.mockImplementation(async (input) => {
      return modelResponse(String(input).endsWith('/videos/models'))
    })

    vi.stubGlobal('fetch', fetchMock)

    const pending = GET(catalogRequest())

    expect(fetchMock).not.toHaveBeenCalled()

    gate.resolve()

    const response = await pending
    const bodyText = await response.text()

    if (response.status !== 200) {
      throw new Error(bodyText)
    }

    const body = RouteBodySchema.parse(JSON.parse(bodyText))
    const [firstCall] = fetchMock.mock.calls

    expect(new Headers(firstCall?.[1]?.headers).get('Authorization')).toBe(`Bearer ${TOKEN}`)

    expect(
      body.entries.map((entry) => {
        return entry.modelId
      }),
    ).toContain(VIDEO_MODELS[0]?.id)

    expect(
      body.entries.map((entry) => {
        return entry.modelId
      }),
    ).toContain(IMAGE_MODELS[0]?.id)
  })
})
