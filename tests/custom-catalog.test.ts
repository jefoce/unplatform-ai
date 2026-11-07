/* eslint-disable max-lines, max-lines-per-function -- catalog cases share one custom endpoint table */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import imageFixture from '../docs/protocol/upai-1/fixtures/models-image.json'
import invalidFixture from '../docs/protocol/upai-1/fixtures/models-invalid.json'
import videoFixture from '../docs/protocol/upai-1/fixtures/models-video.json'
import type { CatalogEntry } from '../src/core/catalog'
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

const { clearEndpointModelCache, markEndpointUnreachable, writeEndpointModels } =
  await import('@/server/services/endpoint-model-cache')

const {
  clearModelCatalog,
  findImagePresetAny,
  findPresetAny,
  findVideoPresetAny,
  getModelCatalog,
} = await import('@/server/services/model-catalog')

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

function customEntries(entries: readonly CatalogEntry[]): CatalogEntry[] {
  return entries.filter((entry) => {
    return entry.source.kind === 'custom'
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

    const catalog = await getModelCatalog()
    const custom = customEntries(catalog.entries)

    expect(custom).toHaveLength(2)

    expect(entryFor(custom, video.id)).toMatchObject({
      presetId: `custom.${endpoint.id}.${video.id}`,
      provider: 'custom',
      status: 'available',
      reason: null,
      availability: { status: 'available', reason: null },
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

    const entry = entryFor(customEntries((await getModelCatalog()).entries), video.id)

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

    const entry = entryFor(customEntries((await getModelCatalog()).entries), video.id)

    expect(entry.status).toBe('available')
    expect(entry.availability).toEqual({ status: 'available', reason: CUSTOM_STALE_REASON })
  })

  it('carries the mapped preset on the entry', async () => {
    const video = modelAt(VIDEO_MODELS, 0)
    const endpoint = customEndpoint('cat-preset', 'CU9')

    await writeEndpoints([endpoint])
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [video] })
    clearModelCatalog()

    const entry = entryFor(customEntries((await getModelCatalog()).entries), video.id)

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

    const entries = customEntries((await getModelCatalog()).entries)

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

    const entry = entryFor(customEntries((await getModelCatalog()).entries), video.id)
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

    const entry = entryFor(customEntries((await getModelCatalog()).entries), invalid.id)

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

    const entry = entryFor(customEntries((await getModelCatalog()).entries), second.id)

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

    const entry = entryFor(customEntries((await getModelCatalog()).entries), video.id)

    expect(entry.status).toBe('unverified')

    expect(entry.availability).toEqual({
      status: 'unverified',
      reason: 'ComfyUI is not reachable.',
    })
  })

  it('hides the presets of a disabled endpoint', async () => {
    const video = modelAt(VIDEO_MODELS, 0)
    const endpoint = customEndpoint('cat-disabled', 'CU7')

    await writeEndpoints([endpoint])
    await writeEndpointModels({ endpointId: endpoint.id, kind: 'video', models: [video] })
    clearModelCatalog()
    await writeEndpoints([customEndpoint('cat-disabled', 'CU7', false)])
    clearModelCatalog()

    expect(customEntries((await getModelCatalog()).entries)).toEqual([])
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
