/* eslint-disable max-lines, max-lines-per-function -- catalog cases share one custom endpoint table */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import imageFixture from '../docs/protocol/upai-1/fixtures/models-image.json'
import invalidFixture from '../docs/protocol/upai-1/fixtures/models-invalid.json'
import videoFixture from '../docs/protocol/upai-1/fixtures/models-video.json'
import type { CatalogEntry, ModelCatalog } from '../src/core/catalog'
import { CUSTOM_CATALOG_MIN_REFRESH_MS, MODEL_CATALOG_TTL_MS } from '../src/core/constants'
import { isVideoPreset } from '../src/core/presets/common/preset-kind'
import { CUSTOM_STALE_REASON } from '../src/core/presets/custom/shared'
import { type UpaiModel, UpaiModelListSchema } from '../src/core/protocol/upai'
import {
  type CustomEndpoint,
  type CustomEndpointPricing,
  CustomEndpointSchema,
} from '../src/core/schemas/custom-endpoint'

const ROOT = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-custom-catalog-'))
const DATA_DIR = path.join(ROOT, 'data')
const ENDPOINTS_FILE = path.join(DATA_DIR, 'endpoints.json')

vi.stubEnv('STORAGE_ROOT', ROOT)

vi.mock('@/server/secrets', () => {
  return {
    secretsReady: async () => {},
    registerSecretsListener: () => {},
    getSecret: () => {
      return null
    },
  }
})

vi.mock('@/server/session', () => {
  return {
    hasSession: () => {
      return true
    },
  }
})

const providerMocks = vi.hoisted(() => {
  return {
    getPricing: vi.fn(async () => {
      return { skus: {}, listSkus: {}, discount: 0, source: 'fallback', fetchedAt: '' }
    }),
  }
})

vi.mock('@/server/providers/registry', () => {
  const provider = {
    getPricing: providerMocks.getPricing,
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

const {
  clearEndpointModelCache,
  isEndpointUnreachable,
  markEndpointUnreachable,
  readEndpointModels,
  writeEndpointModels,
} = await import('@/server/services/endpoint-model-cache')

const {
  clearModelCatalog,
  findImagePresetAny,
  findPresetAny,
  findVideoPresetAny,
  getModelCatalog,
} = await import('@/server/services/model-catalog')

const { clearCustomCatalog, ensureCustomCatalog, refreshCustomCatalog } =
  await import('@/server/services/model-catalog-custom')

const { getHealth } = await import('@/server/services/endpoint-health')

const { GET } = await import('@/app/api/models/route')

const RouteBodySchema = z.object({
  entries: z.array(
    z
      .object({
        modelId: z.string(),
        presetId: z.string(),
        status: z.string(),
        reason: z.string().nullable(),
      })
      .loose(),
  ),
})

const VIDEO_MODELS = UpaiModelListSchema.parse(videoFixture).data
const IMAGE_MODELS = UpaiModelListSchema.parse(imageFixture).data
const INVALID_MODELS = UpaiModelListSchema.parse(invalidFixture).data

function modelAt(models: readonly UpaiModel[], index: number): UpaiModel {
  const model = models[index]

  if (isNil(model)) {
    throw new Error(`Missing fixture model ${index}`)
  }

  return model
}

function customEndpoint(id: string, badge: string, isEnabled = true): CustomEndpoint {
  return CustomEndpointSchema.parse({
    id,
    label: id,
    badge,
    baseUrl: 'http://127.0.0.1:8188',
    enabled: isEnabled,
  })
}

function pricedEndpoint(id: string, badge: string, pricing: CustomEndpointPricing): CustomEndpoint {
  return CustomEndpointSchema.parse({
    id,
    label: id,
    badge,
    baseUrl: 'http://127.0.0.1:8188',
    pricing,
  })
}

function healthEndpoint(id: string, badge: string, maxUploadBytes: number): CustomEndpoint {
  return CustomEndpointSchema.parse({
    id,
    label: id,
    badge,
    baseUrl: 'http://127.0.0.1:8188',
    lastHealth: {
      protocol: 1,
      serverVersion: '0.43.0',
      maxRunning: 2,
      lanAllowed: true,
      authRequired: false,
      maxUploadBytes,
      checkedAt: new Date().toISOString(),
    },
  })
}

async function writeEndpoints(endpoints: readonly CustomEndpoint[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })

  await fs.writeFile(
    ENDPOINTS_FILE,
    JSON.stringify({ version: 1, endpoints, badgeCounter: endpoints.length }),
  )
}

function mockModelFetch() {
  const mock = vi.fn(async (input: string | URL | Request) => {
    const url = String(input)
    const body = url.endsWith('/videos/models') ? videoFixture : imageFixture

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })

  vi.stubGlobal('fetch', mock)

  return mock
}

interface ListFetchParams {
  video?: readonly UpaiModel[]
  image?: readonly UpaiModel[]
}

function mockListFetch(params: ListFetchParams) {
  const { video = [], image = [] } = params

  const mock = vi.fn(async (input: string | URL | Request) => {
    const url = String(input)
    const data = url.endsWith('/videos/models') ? video : image

    return jsonResponse({ version: 1, data })
  })

  vi.stubGlobal('fetch', mock)

  return mock
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function customEntries(entries: readonly CatalogEntry[]): CatalogEntry[] {
  return entries.filter((entry) => {
    return entry.source.kind === 'custom'
  })
}

function idsOf(entries: readonly CatalogEntry[]): string[] {
  return entries.map((entry) => {
    return entry.modelId
  })
}

/** Loads the custom catalog the way an awaited lookup does, then reads the catalog. */
async function getLoadedCatalog(): Promise<ModelCatalog> {
  await ensureCustomCatalog({ isRefresh: false })

  return getModelCatalog()
}

function catalogRequest(query = ''): Request {
  return new Request(`http://127.0.0.1:3000/api/models${query}`, {
    headers: { host: '127.0.0.1:3000' },
  })
}

function entryFor(entries: readonly CatalogEntry[], modelId: string): CatalogEntry {
  const entry = entries.find((item) => {
    return item.modelId === modelId || item.presetId === modelId
  })

  if (isNil(entry)) {
    throw new Error(`Missing catalog entry ${modelId}`)
  }

  return entry
}

beforeEach(() => {
  clearModelCatalog()
  clearEndpointModelCache()
  providerMocks.getPricing.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

afterAll(async () => {
  vi.unstubAllEnvs()
  await fs.rm(ROOT, { recursive: true, force: true })
})

describe('custom catalog', () => {
  it('adds enabled endpoint presets next to unchanged static entries', async () => {
    const video = modelAt(VIDEO_MODELS, 0)
    const image = modelAt(IMAGE_MODELS, 0)
    const endpoint = customEndpoint('cat-basic', 'CU1')

    await writeEndpoints([endpoint])
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [video] })
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'image', models: [image] })
    clearModelCatalog()
    mockListFetch({ video: [video], image: [image] })

    const catalog = await getLoadedCatalog()
    const custom = customEntries(catalog.entries)

    expect(custom).toHaveLength(2)

    expect(entryFor(custom, video.id)).toMatchObject({
      presetId: `custom.${endpoint.id}.${video.id}`,
      provider: 'custom',
      status: 'available',
      reason: null,
      source: {
        kind: 'custom',
        instanceId: endpoint.id,
        badge: 'CU1',
        workflowName: null,
        local: true,
      },
    })

    expect(entryFor(custom, image.id).source.local).toBe(true)

    const staticEntry = entryFor(catalog.entries, 'gemini-3.1-flash-image')

    expect(staticEntry.source).toEqual({
      kind: 'openrouter',
      instanceId: 'openrouter',
      badge: null,
      workflowName: null,
      local: false,
    })
  })

  it('carries the workflow name and the model pricing into the entry', async () => {
    const base = modelAt(VIDEO_MODELS, 0)

    const video: UpaiModel = {
      ...base,
      description: 'Local Wan workflow',
      pricing: { per_run_usd: 0.25 },
      workflow: { id: 'wan22', name: 'Wan 2.2' },
    }

    const endpoint = customEndpoint('cat-workflow', 'CU2')

    await writeEndpoints([endpoint])
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [video] })
    clearModelCatalog()

    const entry = entryFor(customEntries((await getLoadedCatalog()).entries), video.id)

    expect(entry.source.workflowName).toBe('Wan 2.2')
    expect(entry.preset?.workflowName).toBe('Wan 2.2')
    expect(entry.preset?.description).toBe('Local Wan workflow')
    expect(entry.pricing?.skus.per_run).toBe(0.25)
  })

  it('marks a stale model available with the workflow hint', async () => {
    const base = modelAt(VIDEO_MODELS, 0)
    const video: UpaiModel = { ...base, status: 'stale', status_reason: 'workflow is newer' }
    const endpoint = customEndpoint('cat-stale', 'CU3')

    await writeEndpoints([endpoint])
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [video] })
    clearModelCatalog()
    mockListFetch({ video: [video] })

    const entry = entryFor(customEntries((await getLoadedCatalog()).entries), video.id)

    expect(entry.status).toBe('available')
    expect(entry.reason).toBe(CUSTOM_STALE_REASON)
  })

  it('carries the mapped preset on the entry', async () => {
    const video = modelAt(VIDEO_MODELS, 0)
    const endpoint = customEndpoint('cat-preset', 'CU9')

    await writeEndpoints([endpoint])
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [video] })
    clearModelCatalog()

    const entry = entryFor(customEntries((await getLoadedCatalog()).entries), video.id)

    expect(entry.preset).toMatchObject({
      id: `custom.${endpoint.id}.${video.id}`,
      title: video.name,
      family: 'custom',
    })
  })

  it('uses the endpoint price override for the entry fallback', async () => {
    const base = modelAt(VIDEO_MODELS, 0)
    const model: UpaiModel = { ...base, pricing: { per_run_usd: 0.25 } }
    const free = pricedEndpoint('cat-price-free', 'CUA', { mode: 'free', usd: 3 })
    const perRun = pricedEndpoint('cat-price-run', 'CUB', { mode: 'perRun', usd: 2 })
    const perSecond = pricedEndpoint('cat-price-sec', 'CUC', { mode: 'perSecond', usd: 5 })

    await writeEndpoints([free, perRun, perSecond])

    for (const endpoint of [free, perRun, perSecond]) {
      await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [model] })
    }

    clearModelCatalog()

    const entries = customEntries((await getLoadedCatalog()).entries)

    expect(entryFor(entries, `custom.${free.id}.${model.id}`).pricing?.skus.per_run).toBe(0)
    expect(entryFor(entries, `custom.${perRun.id}.${model.id}`).pricing?.skus.per_run).toBe(2)
    expect(entryFor(entries, `custom.${perSecond.id}.${model.id}`).pricing?.skus.per_run).toBe(5)
  })

  it('carries the endpoint max upload size into the reference limits', async () => {
    const video = modelAt(VIDEO_MODELS, 0)
    const maxUploadBytes = 12 * 1024 * 1024
    const endpoint = healthEndpoint('cat-upload', 'CUD', maxUploadBytes)

    await writeEndpoints([endpoint])
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [video] })
    clearModelCatalog()

    const entry = entryFor(customEntries((await getLoadedCatalog()).entries), video.id)
    const preset = entry.preset

    if (isNil(preset) || !isVideoPreset(preset)) {
      throw new Error('Expected a video preset')
    }

    expect(preset.referenceLimits?.video?.maxBytes).toBe(maxUploadBytes)
    expect(preset.referenceLimits?.audio?.maxBytes).toBe(maxUploadBytes)
  })

  it('marks an invalid model invalid with its status reason', async () => {
    const invalid = modelAt(INVALID_MODELS, 0)
    const endpoint = customEndpoint('cat-invalid', 'CU4')

    await writeEndpoints([endpoint])
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'image', models: [invalid] })
    clearModelCatalog()
    mockListFetch({ image: [invalid] })

    const entry = entryFor(customEntries((await getLoadedCatalog()).entries), invalid.id)

    expect(entry.status).toBe('invalid')
    expect(entry.reason).toBe('node class KSampler is not installed')
  })

  it('marks a model missing after a successful fetch drops it', async () => {
    const first = modelAt(VIDEO_MODELS, 0)
    const second = modelAt(VIDEO_MODELS, 1)
    const endpoint = customEndpoint('cat-missing', 'CU5')

    await writeEndpoints([endpoint])

    await writeEndpointModels({
      endpointId: endpoint.id,
      kind: 'video',
      models: [first, second],
    })

    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [first] })
    clearModelCatalog()
    mockListFetch({ video: [first] })

    const entry = entryFor(customEntries((await getLoadedCatalog()).entries), second.id)

    expect(entry.status).toBe('missing')
    expect(entry.reason).toBe('This workflow is gone from ComfyUI.')
  })

  it('marks every cached model unverified while the endpoint is unreachable', async () => {
    const video = modelAt(VIDEO_MODELS, 0)
    const endpoint = customEndpoint('cat-offline', 'CU6')

    await writeEndpoints([endpoint])
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [video] })
    clearModelCatalog()
    markEndpointUnreachable(endpoint.id)

    const entry = entryFor(customEntries((await getLoadedCatalog()).entries), video.id)

    expect(entry.status).toBe('unverified')
    expect(entry.reason).toBe('ComfyUI is not reachable.')
  })

  it('hides the presets of a disabled endpoint', async () => {
    const video = modelAt(VIDEO_MODELS, 0)
    const endpoint = customEndpoint('cat-disabled', 'CU7')

    await writeEndpoints([endpoint])
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [video] })
    clearModelCatalog()
    await writeEndpoints([customEndpoint('cat-disabled', 'CU7', false)])
    clearModelCatalog()

    expect(customEntries((await getLoadedCatalog()).entries)).toEqual([])
  })

  it('fetches both lists when a tested endpoint has no cache', async () => {
    const video = modelAt(VIDEO_MODELS, 0)
    const endpoint = healthEndpoint('cat-net-new', 'CUF', 1000)

    await writeEndpoints([endpoint])
    const fetchMock = mockModelFetch()

    clearModelCatalog()

    const entries = customEntries((await getLoadedCatalog()).entries)

    expect(entryFor(entries, video.id).status).toBe('available')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(await readEndpointModels(endpoint.id)).not.toBeNull()
  })

  it('loads custom entries on the first call without a prior refresh', async () => {
    const video = modelAt(VIDEO_MODELS, 0)
    const endpoint = customEndpoint('cat-cold', 'CUV')

    await writeEndpoints([endpoint])
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [video] })
    clearModelCatalog()
    mockListFetch({ video: [video] })

    const catalog = await ensureCustomCatalog({ isRefresh: false })

    expect(catalog.entries).toHaveLength(1)
    expect(catalog.entries[0]?.presetId).toBe(`custom.${endpoint.id}.${video.id}`)
  })

  it('refreshes a stale cache behind a normal request', async () => {
    const first = modelAt(VIDEO_MODELS, 0)
    const second = modelAt(VIDEO_MODELS, 1)
    const endpoint = customEndpoint('cat-stale-cache', 'CUU')

    await writeEndpoints([endpoint])
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [first] })
    clearModelCatalog()

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    mockListFetch({ video: [first] })

    const cold = await getModelCatalog()

    expect(idsOf(customEntries(cold.entries))).toContain(first.id)

    vi.setSystemTime(new Date(Date.now() + MODEL_CATALOG_TTL_MS + 1))
    const fetchMock = mockListFetch({ video: [first, second] })

    const cached = await getModelCatalog()

    expect(idsOf(customEntries(cached.entries))).not.toContain(second.id)

    await refreshCustomCatalog()

    expect(fetchMock).toHaveBeenCalledTimes(2)

    const after = await getModelCatalog()

    expect(idsOf(customEntries(after.entries))).toContain(second.id)
  })

  it('marks an endpoint ok after the picker fetches its models', async () => {
    const endpoint = customEndpoint('cat-health-ok', 'CUK')

    await writeEndpoints([endpoint])
    mockModelFetch()
    clearModelCatalog()

    await getLoadedCatalog()

    expect(getHealth(endpoint.id)?.state).toBe('ok')
  })

  it('keeps the cached list available after one failed fetch', async () => {
    const video = modelAt(VIDEO_MODELS, 0)
    const endpoint = healthEndpoint('cat-net-fail', 'CUG', 1000)

    await writeEndpoints([endpoint])

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [video] })
    vi.setSystemTime(new Date('2026-01-01T00:02:00Z'))
    clearModelCatalog()

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
    )

    const entries = customEntries((await getLoadedCatalog()).entries)

    expect(entryFor(entries, video.id).status).toBe('available')
    expect(getHealth(endpoint.id)).toBeNull()
    expect(isEndpointUnreachable(endpoint.id)).toBe(false)
  })

  it('keeps cached models available when the model list times out once', async () => {
    const video = modelAt(VIDEO_MODELS, 0)
    const endpoint = customEndpoint('cat-timeout', 'CUT')

    await writeEndpoints([endpoint])

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [video] })
    vi.setSystemTime(new Date(Date.now() + MODEL_CATALOG_TTL_MS + 1))
    clearModelCatalog()

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const error = new Error('Request timed out')

        error.name = 'TimeoutError'

        throw error
      }),
    )

    const entries = customEntries((await getLoadedCatalog()).entries)

    expect(entryFor(entries, video.id).status).toBe('available')
    expect(getHealth(endpoint.id)).toBeNull()
    expect(isEndpointUnreachable(endpoint.id)).toBe(false)
  })

  it('fetches both lists for an untested endpoint with a stale cache', async () => {
    const video = modelAt(VIDEO_MODELS, 0)
    const endpoint = customEndpoint('cat-net-off', 'CUH')

    await writeEndpoints([endpoint])

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [video] })
    vi.setSystemTime(new Date('2026-01-01T00:02:00Z'))
    clearModelCatalog()

    const fetchMock = mockModelFetch()

    const entries = customEntries((await getLoadedCatalog()).entries)

    expect(entryFor(entries, video.id).status).toBe('available')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns fresh entries on a forced refresh', async () => {
    const first = modelAt(VIDEO_MODELS, 0)
    const second = modelAt(VIDEO_MODELS, 1)
    const endpoint = customEndpoint('cat-explicit', 'CUS')

    await writeEndpoints([endpoint])
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [first] })
    clearModelCatalog()
    mockListFetch({ video: [first] })
    await ensureCustomCatalog({ isRefresh: false })

    const fetchMock = mockListFetch({ video: [first, second] })
    const data = await ensureCustomCatalog({ isRefresh: true, isForce: true })

    expect(idsOf(customEntries(data.entries))).toContain(second.id)
    expect(entryFor(data.entries, second.id).status).toBe('available')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('skips an automatic refresh while the custom cache is young', async () => {
    const first = modelAt(VIDEO_MODELS, 0)
    const second = modelAt(VIDEO_MODELS, 1)
    const endpoint = customEndpoint('cat-auto-young', 'CUT')

    await writeEndpoints([endpoint])
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [first] })
    clearModelCatalog()

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    mockListFetch({ video: [first] })
    await ensureCustomCatalog({ isRefresh: false })

    const fetchMock = mockListFetch({ video: [first, second] })
    const data = await ensureCustomCatalog({ isRefresh: true })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(idsOf(customEntries(data.entries))).not.toContain(second.id)
  })

  it('refreshes automatically after the minimum gap', async () => {
    const first = modelAt(VIDEO_MODELS, 0)
    const second = modelAt(VIDEO_MODELS, 1)
    const endpoint = customEndpoint('cat-auto-old', 'CUO')

    await writeEndpoints([endpoint])
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [first] })
    clearModelCatalog()

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    mockListFetch({ video: [first] })
    await ensureCustomCatalog({ isRefresh: false })

    vi.setSystemTime(new Date(Date.now() + CUSTOM_CATALOG_MIN_REFRESH_MS + 1))
    const fetchMock = mockListFetch({ video: [first, second] })
    const data = await ensureCustomCatalog({ isRefresh: true })

    expect(idsOf(customEntries(data.entries))).toContain(second.id)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('forces a refresh even while the custom cache is young', async () => {
    const first = modelAt(VIDEO_MODELS, 0)
    const second = modelAt(VIDEO_MODELS, 1)
    const endpoint = customEndpoint('cat-auto-force', 'CUF')

    await writeEndpoints([endpoint])
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [first] })
    clearModelCatalog()

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    mockListFetch({ video: [first] })
    await ensureCustomCatalog({ isRefresh: false })

    const fetchMock = mockListFetch({ video: [first, second] })
    const data = await ensureCustomCatalog({ isRefresh: true, isForce: true })

    expect(idsOf(customEntries(data.entries))).toContain(second.id)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('reloads when a clear lands during a cold load', async () => {
    const first = modelAt(VIDEO_MODELS, 0)
    const second = modelAt(VIDEO_MODELS, 1)
    const endpoint = customEndpoint('cat-clear-race', 'CUW')

    await writeEndpoints([endpoint])
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [first] })
    clearModelCatalog()

    const deferred: Array<(response: Response) => void> = []
    let hasCleared = false

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        if (!hasCleared) {
          return new Promise<Response>((resolve) => {
            deferred.push(resolve)
          })
        }

        const url = String(input)
        const data = url.endsWith('/videos/models') ? [second] : []

        return jsonResponse({ version: 1, data })
      }),
    )

    const pendingCatalog = ensureCustomCatalog({ isRefresh: false })

    await vi.waitFor(() => {
      expect(deferred).toHaveLength(2)
    })

    clearCustomCatalog()
    hasCleared = true

    for (const resolve of deferred) {
      resolve(jsonResponse({ version: 1, data: [] }))
    }

    const data = await pendingCatalog

    expect(idsOf(customEntries(data.entries))).toContain(second.id)
    expect(customEntries(data.entries)).not.toHaveLength(0)
  })
})

describe('GET /api/models', () => {
  it('returns a changed custom model on a forced refresh', async () => {
    const first = modelAt(VIDEO_MODELS, 0)
    const second = modelAt(VIDEO_MODELS, 1)
    const endpoint = customEndpoint('cat-route-changed', 'CUI', true)

    await writeEndpoints([endpoint])
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [first] })
    clearModelCatalog()
    mockListFetch({ video: [first] })
    await ensureCustomCatalog({ isRefresh: false })

    mockListFetch({ video: [first, second] })

    const response = await GET(catalogRequest('?refresh=1&force=1'))
    const body = RouteBodySchema.parse(await response.json())

    expect(response.status).toBe(200)

    const entry = body.entries.find((item) => {
      return item.modelId === second.id
    })

    expect(entry?.status).toBe('available')
  })

  it('skips the fetch on an automatic refresh while the cache is young', async () => {
    const first = modelAt(VIDEO_MODELS, 0)
    const endpoint = customEndpoint('cat-route-young', 'CUR', true)

    await writeEndpoints([endpoint])
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [first] })
    clearModelCatalog()
    mockListFetch({ video: [first] })
    await ensureCustomCatalog({ isRefresh: false })

    const fetchMock = vi.fn()

    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(catalogRequest('?refresh=1'))

    expect(response.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('awaits the custom refresh and reports the unreachable endpoint', async () => {
    const video = modelAt(VIDEO_MODELS, 0)
    const endpoint = healthEndpoint('cat-route-force', 'CUI', 1000)

    await writeEndpoints([endpoint])
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [video] })
    clearModelCatalog()
    mockListFetch({ video: [video] })
    await ensureCustomCatalog({ isRefresh: false })

    const fetchMock = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })

    vi.stubGlobal('fetch', fetchMock)

    await GET(catalogRequest('?refresh=1&force=1'))

    const response = await GET(catalogRequest('?refresh=1&force=1'))
    const body = RouteBodySchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalled()
    expect(getHealth(endpoint.id)?.state).toBe('unreachable')

    const entry = body.entries.find((item) => {
      return item.modelId === video.id
    })

    expect(entry?.status).toBe('unverified')
  })

  it('serves a fresh cache without a fetch when refresh is absent', async () => {
    const video = modelAt(VIDEO_MODELS, 0)
    const endpoint = healthEndpoint('cat-route-fresh', 'CUJ', 1000)

    await writeEndpoints([endpoint])
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [video] })
    clearModelCatalog()
    mockListFetch({ video: [video] })
    await ensureCustomCatalog({ isRefresh: false })

    const fetchMock = vi.fn()

    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(catalogRequest())
    const body = RouteBodySchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()

    const entry = body.entries.find((item) => {
      return item.modelId === video.id
    })

    expect(entry?.status).toBe('available')
  })
})

describe('findPresetAny', () => {
  it('resolves static presets with the static source', async () => {
    const found = await findPresetAny('wan-3.0')

    expect(found?.preset.id).toBe('wan-3.0')
    expect(found?.source.kind).toBe('openrouter')
    expect(found?.source.instanceId).toBe('openrouter')
  })

  it('resolves a custom preset with its endpoint source', async () => {
    const video = modelAt(VIDEO_MODELS, 0)
    const endpoint = customEndpoint('cat-find', 'CU8')

    await writeEndpoints([endpoint])
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [video] })
    clearModelCatalog()

    const found = await findPresetAny(`custom.${endpoint.id}.${video.id}`)

    expect(found?.preset.id).toBe(`custom.${endpoint.id}.${video.id}`)
    expect(found?.preset.title).toBe(video.name)

    expect(found?.source).toMatchObject({
      kind: 'custom',
      instanceId: endpoint.id,
      badge: 'CU8',
      local: true,
    })
  })

  it('returns null for an unknown preset', async () => {
    expect(await findPresetAny('custom.unknown.model')).toBeNull()
  })

  it('returns null for a removed workflow after a refresh', async () => {
    const video = modelAt(VIDEO_MODELS, 0)
    const endpoint = customEndpoint('cat-removed', 'CUR')
    const presetId = `custom.${endpoint.id}.${video.id}`

    await writeEndpoints([endpoint])
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [video] })
    clearModelCatalog()
    mockListFetch({ video: [video] })

    expect(await findPresetAny(presetId)).not.toBeNull()

    await writeEndpoints([customEndpoint('cat-removed', 'CUR', false)])
    await refreshCustomCatalog()

    expect(await findPresetAny(presetId)).toBeNull()
  })
})

describe('find preset by kind', () => {
  it('resolves custom video and image presets and rejects the other kind', async () => {
    const video = modelAt(VIDEO_MODELS, 0)
    const image = modelAt(IMAGE_MODELS, 0)
    const endpoint = customEndpoint('cat-kind', 'CUE')
    const videoId = `custom.${endpoint.id}.${video.id}`
    const imageId = `custom.${endpoint.id}.${image.id}`

    await writeEndpoints([endpoint])
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [video] })
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'image', models: [image] })
    clearModelCatalog()

    expect((await findVideoPresetAny(videoId))?.id).toBe(videoId)
    expect((await findImagePresetAny(imageId))?.id).toBe(imageId)
    expect(await findVideoPresetAny(imageId)).toBeNull()
    expect(await findImagePresetAny(videoId)).toBeNull()
  })
})
