import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_IMAGE_PRESET_ID, findImagePreset } from '@/core/presets/image'
import type { ImagePreset } from '@/core/presets/image/types'
import { UpaiJobSchema } from '@/core/protocol/upai'
import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'
import type { ImageGenerationInput } from '@/core/schemas/image-record'

vi.mock('@/server/secrets', () => {
  return {
    getSecret: () => {
      return null
    },
    secretsReady: async () => {},
  }
})

const { createCustomImageProvider } = await import('@/server/providers/custom/image')

const ROOT = 'docs/protocol/upai-1/fixtures'

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
  seed: true,
  params: ['n', 'aspect_ratio', 'resolution', 'seed', 'input_references'],
  maxN: 4,
  bindings: [
    {
      provider: 'custom',
      modelId: 'sdxl',
      pricing: { formula: 'perRun', skuRules: [], fallback: { run: 0 } },
    },
  ],
}

const INPUT: ImageGenerationInput = {
  presetId: 'custom.ep1.sdxl',
  prompt: 'a cat',
  count: 2,
  aspectRatio: '1:1',
  resolution: '1K',
  quality: null,
  background: null,
  references: ['ref1', 'ref2'],
  seed: 7,
}

const REFERENCES = [
  { id: 'ref1', dataUrl: 'data:image/png;base64,AA' },
  { id: 'ref2', dataUrl: 'data:image/png;base64,BB' },
]

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function fixture(name: string): Promise<unknown> {
  const raw = await readFile(path.join(process.cwd(), ROOT, name), 'utf8')

  return JSON.parse(raw)
}

describe('custom image adapter', () => {
  it('creates an async job, polls, then returns the real media types', async () => {
    const created = await fixture('create-job-image.json')
    const pending = UpaiJobSchema.parse(await fixture('job-pending.json'))
    const done = UpaiJobSchema.parse(await fixture('job-completed.json'))

    const completed = {
      ...done,
      kind: 'image',
      model: 'sdxl',
      urls: [
        'http://127.0.0.1:8188/upai/api/v1/images/jobs/x/content?index=0',
        'http://127.0.0.1:8188/upai/api/v1/images/jobs/x/content?index=1',
      ],
    }

    const inProgress = { ...pending, kind: 'image', model: 'sdxl' }

    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(created), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(inProgress), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(completed), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([4, 5]), {
          status: 200,
          headers: { 'content-type': 'image/jpeg; charset=binary' },
        }),
      )

    const provider = createCustomImageProvider(ENDPOINT)
    const result = await provider.generate({ preset: PRESET, input: INPUT, references: REFERENCES })

    const body: unknown = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))

    expect(body).toMatchObject({
      model: 'sdxl',
      prompt: 'a cat',
      n: 2,
      resolution: '1K',
      aspect_ratio: '1:1',
      seed: 7,
      input_references: [
        { type: 'image_url', image_url: { url: 'data:image/png;base64,AA' } },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,BB' } },
      ],
    })

    expect(result.costUsd).toBe(0)

    expect(result.items).toEqual([
      { b64: Buffer.from([1, 2, 3]).toString('base64'), mediaType: 'image/png' },
      { b64: Buffer.from([4, 5]).toString('base64'), mediaType: 'image/jpeg' },
    ])
  })

  it('uses count.max as maxN', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(await fixture('models-image.json')), { status: 200 }),
    )

    const provider = createCustomImageProvider(ENDPOINT)
    const models = await provider.listModels()

    expect(models.models[0]?.maxN).toBe(4)
    expect(models.models[0]?.referenceMax).toBe(1)
  })
})
