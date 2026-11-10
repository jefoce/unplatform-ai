import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_IMAGE_PRESET_ID, findImagePreset } from '@/core/presets/image'
import type { ImagePreset } from '@/core/presets/image/types'
import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'
import type { ImageGenerationInput } from '@/core/schemas/image-record'

vi.mock('@/core/constants', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/core/constants')

  return { ...actual, IMAGE_COUNT_MAX: 2, IMAGE_OUTPUT_MAX_BYTES: 8 }
})

vi.mock('@/server/providers/custom/endpoint-source', () => {
  return {
    getEndpointToken: () => {
      return null
    },
    getEndpointSync: () => {
      return ENDPOINT
    },
  }
})

vi.mock('@/server/secrets', () => {
  return {
    getSecret: () => {
      return null
    },
    secretsReady: async () => {},
  }
})

const { createCustomImageProvider } = await import('@/server/providers/custom/image')

const JOB_ID = '11111111-1111-4111-8111-111111111111'

const ENDPOINT: CustomEndpoint = {
  id: 'ep1',
  label: 'Local',
  badge: 'CU1',
  baseUrl: 'http://127.0.0.1:8188',
  enabled: true,
  pricing: { mode: 'model', usd: 0 },
  instanceId: 'pack-1',
  lastHealth: null,
}

const base = findImagePreset(DEFAULT_IMAGE_PRESET_ID)

if (base === null) {
  throw new Error('image preset missing')
}

const PRESET: ImagePreset = {
  ...base,
  id: 'custom.ep1.sdxl',
  title: 'SDXL',
  params: ['n'],
  maxN: 4,
  bindings: [
    {
      provider: 'custom',
      modelId: 'sdxl',
      pricing: { formula: 'perRun', skuRules: [], fallback: { run: 0 } },
    },
  ],
}

function input(count: number): ImageGenerationInput {
  return {
    presetId: PRESET.id,
    prompt: 'a cat',
    count,
    aspectRatio: 'auto',
    resolution: null,
    quality: null,
    background: null,
    references: [],
    seed: null,
  }
}

function completedJob(urlCount: number) {
  return {
    id: JOB_ID,
    kind: 'image',
    model: 'sdxl',
    status: 'completed',
    progress: null,
    seed: 1,
    urls: Array.from({ length: urlCount }, (_, index) => {
      return `http://127.0.0.1:8188/upai/api/v1/images/jobs/${JOB_ID}/content?index=${index}`
    }),
    error: null,
    usage: { cost: 0 },
    created_at: '2026-11-05T12:00:00Z',
    started_at: '2026-11-05T12:00:01Z',
    finished_at: '2026-11-05T12:00:06Z',
    expires_at: null,
  }
}

function createdJob(): Response {
  return new Response(
    JSON.stringify({
      id: JOB_ID,
      status: 'pending',
      polling_url: `/upai/api/v1/images/jobs/${JOB_ID}`,
    }),
    { status: 202, headers: { 'content-type': 'application/json' } },
  )
}

function jobResponse(urlCount: number): Response {
  return new Response(JSON.stringify(completedJob(urlCount)), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function imageResponse(bytes: number): Response {
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { 'content-type': 'image/png' },
  })
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function generate(count: number) {
  return createCustomImageProvider(ENDPOINT).generate({
    preset: PRESET,
    input: input(count),
    references: [],
  })
}

describe('custom image response caps', () => {
  it('rejects an image over the output cap', async () => {
    fetchMock
      .mockResolvedValueOnce(createdJob())
      .mockResolvedValueOnce(jobResponse(1))
      .mockResolvedValueOnce(imageResponse(9))

    const result = await generate(1)

    expect(result.items).toEqual([
      { error: 'upai:too_large: Image response is larger than the limit' },
    ])
  })

  it('fetches no more than the app image count cap', async () => {
    fetchMock
      .mockResolvedValueOnce(createdJob())
      .mockResolvedValueOnce(jobResponse(3))
      .mockResolvedValueOnce(imageResponse(1))
      .mockResolvedValueOnce(imageResponse(1))

    const result = await generate(3)

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(result.items).toHaveLength(2)
  })

  it('keeps a body under the cap', async () => {
    fetchMock
      .mockResolvedValueOnce(createdJob())
      .mockResolvedValueOnce(jobResponse(1))
      .mockResolvedValueOnce(imageResponse(3))

    const result = await generate(1)

    expect(result.items).toEqual([
      { b64: Buffer.from([0, 0, 0]).toString('base64'), mediaType: 'image/png' },
    ])
  })
})
