/* eslint-disable max-lines, max-lines-per-function -- one custom catalog fixture drives every estimate case */

import fs from 'node:fs/promises'

import { isNil } from 'lodash-es'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import imageFixture from '../docs/protocol/upai-1/fixtures/models-image.json'
import invalidFixture from '../docs/protocol/upai-1/fixtures/models-invalid.json'
import videoFixture from '../docs/protocol/upai-1/fixtures/models-video.json'
import type { CatalogEntry, CatalogEntrySource, ModelStatus } from '../src/core/catalog'
import { isImagePreset, isVideoPreset } from '../src/core/presets/common/preset-kind'
import { mapCustomModel } from '../src/core/presets/custom/from-capabilities'
import { IMAGE_PRESETS } from '../src/core/presets/image'
import type { ImagePreset } from '../src/core/presets/image/types'
import type { VideoPreset } from '../src/core/presets/video/types'
import { type UpaiModel, UpaiModelListSchema } from '../src/core/protocol/upai'
import { CustomEndpointSchema } from '../src/core/schemas/custom-endpoint'
import type { GenerationInput } from '../src/core/schemas/generation-record'
import type { PriceInput } from '../src/core/validation/video'
import { ValidationError } from '../src/server/errors'

const ROOT = vi.hoisted(() => {
  const os = process.getBuiltinModule('node:os')
  const path = process.getBuiltinModule('node:path')
  const root = path.join(os.tmpdir(), `cf-custom-estimate-${process.pid}`)

  process.env.STORAGE_ROOT = root

  return root
})

interface PresetSourceState {
  preset: VideoPreset | ImagePreset
  source: CatalogEntrySource
}

const catalogState = vi.hoisted(() => {
  return {
    entries: [] as CatalogEntry[],
    presets: [] as PresetSourceState[],
  }
})

const providers = vi.hoisted(() => {
  const pricing = {
    skus: {},
    listSkus: {},
    discount: 0,
    source: 'fallback' as const,
    fetchedAt: '',
  }

  const base = (id: string) => {
    return {
      id,
      isConfigured: () => {
        return true
      },
      getPricing: async () => {
        return pricing
      },
      listModels: async () => {
        return { models: [], isFresh: true }
      },
      listEndpoints: async () => {
        return { state: 'unknown', reason: 'not checked' }
      },
    }
  }

  return {
    getVideoProvider: vi.fn((id: string) => {
      return base(id)
    }),
    getImageProvider: vi.fn((id: string) => {
      return base(id)
    }),
  }
})

const loadUploads = vi.hoisted(() => {
  return vi.fn(async () => {
    return {}
  })
})

vi.mock('@/server/services/model-catalog-custom', () => {
  return {
    loadCustomCatalog: async () => {
      return { entries: catalogState.entries, presets: catalogState.presets }
    },
    findCustomPreset: (presetId: string) => {
      return (
        catalogState.presets.find((item) => {
          return item.preset.id === presetId
        }) ?? null
      )
    },
    clearCustomCatalog: () => {
      catalogState.entries = []
      catalogState.presets = []
    },
  }
})

vi.mock('@/server/providers/registry', () => {
  return providers
})

vi.mock('@/core/providers/registry', () => {
  return {
    providerDescriptor: (id: string) => {
      return { id, label: 'Test' }
    },
  }
})

vi.mock('@/server/secrets', () => {
  return {
    secretsReady: async () => {},
    registerSecretsListener: () => {},
  }
})

vi.mock('@/server/services/uploads', () => {
  return { loadUploads }
})

vi.mock('@/server/repos/generations', () => {
  return {
    getActiveCount: async () => {
      return 0
    },
  }
})

vi.mock('@/server/storage/registry', () => {
  return {
    getObjectStore: () => {
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

const { clearModelCatalog, findImagePresetAny, findVideoPresetAny } =
  await import('@/server/services/model-catalog')

const { estimateGeneration, loadCatalogEntry, loadDraft, loadPriceDraft } =
  await import('@/server/services/estimate-generation')

const { POST: imageEstimate } = await import('@/app/api/images/estimate/route')

const VIDEO_MODELS = UpaiModelListSchema.parse(videoFixture).data
const IMAGE_MODELS = UpaiModelListSchema.parse(imageFixture).data
const INVALID_MODELS = UpaiModelListSchema.parse(invalidFixture).data

const ENDPOINT = CustomEndpointSchema.parse({
  id: 'estimate-endpoint',
  label: 'Estimate',
  badge: 'ES1',
  baseUrl: 'http://127.0.0.1:8188',
})

function modelAt(models: readonly UpaiModel[], index: number): UpaiModel {
  const model = models[index]

  if (isNil(model)) {
    throw new Error(`Missing fixture model ${index}`)
  }

  return model
}

function videoPreset(model: UpaiModel, perRunUsd: number): VideoPreset {
  const mapped = mapCustomModel({
    endpoint: ENDPOINT,
    model: { ...model, pricing: { per_run_usd: perRunUsd } },
  })

  const preset = mapped.preset

  if (isNil(preset) || !isVideoPreset(preset)) {
    throw new Error('Expected a custom video preset')
  }

  return preset
}

function imagePreset(model: UpaiModel, perRunUsd: number): ImagePreset {
  const mapped = mapCustomModel({
    endpoint: ENDPOINT,
    model: { ...model, pricing: { per_run_usd: perRunUsd } },
  })

  const preset = mapped.preset

  if (isNil(preset) || !isImagePreset(preset)) {
    throw new Error('Expected a custom image preset')
  }

  return preset
}

function registerPreset(
  preset: VideoPreset | ImagePreset,
  status: ModelStatus = 'available',
  reason: string | null = null,
): void {
  const source: CatalogEntrySource = {
    kind: 'custom',
    instanceId: ENDPOINT.id,
    badge: ENDPOINT.badge,
    workflowName: null,
    local: true,
  }

  catalogState.presets = [{ preset, source }]

  catalogState.entries = [
    {
      modelId: preset.bindings[0].modelId,
      presetId: preset.id,
      provider: 'custom',
      status,
      reason,
      pricing: null,
      availability: { status, reason },
      source,
      preset,
    },
  ]
}

function videoInput(preset: VideoPreset): GenerationInput {
  return {
    presetId: preset.id,
    tab: 'frames',
    prompt: 'a red fox',
    audio: false,
    duration: preset.duration.default,
    aspectRatio: preset.defaultAspectRatio,
    resolution: preset.defaultResolution,
    frames: { start: null, end: null },
    references: [],
    seed: null,
  }
}

function priceInput(preset: VideoPreset): PriceInput {
  return {
    presetId: preset.id,
    tab: 'frames',
    audio: false,
    duration: preset.duration.default,
    aspectRatio: preset.defaultAspectRatio,
    resolution: preset.defaultResolution,
    frames: { start: null, end: null },
    references: [],
  }
}

beforeEach(() => {
  clearModelCatalog()
  providers.getVideoProvider.mockClear()
  providers.getImageProvider.mockClear()
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
})

describe('custom preset estimates', () => {
  it('loads a custom video draft from the catalog', async () => {
    const preset = videoPreset(modelAt(VIDEO_MODELS, 1), 0)

    registerPreset(preset)

    const draft = await loadDraft(videoInput(preset))

    expect(draft.preset.id).toBe(preset.id)
  })

  it('prices a custom video draft without an upload', async () => {
    const preset = videoPreset(modelAt(VIDEO_MODELS, 1), 0)

    registerPreset(preset)

    const draft = await loadPriceDraft(priceInput(preset))

    expect(draft.preset.id).toBe(preset.id)
  })

  it('charges the custom per-run price and skips the video provider', async () => {
    const preset = videoPreset(modelAt(VIDEO_MODELS, 1), 2.5)

    const estimate = await estimateGeneration({
      preset,
      input: videoInput(preset),
      uploads: {},
    })

    expect(estimate.estimatedUsd).toBeCloseTo(2.5)
    expect(estimate.discount).toBe(0)

    const customCalls = providers.getVideoProvider.mock.calls.filter(([id]) => {
      return id === 'custom'
    })

    expect(customCalls).toHaveLength(0)
  })

  it('returns the flat price for a custom image estimate', async () => {
    const preset = imagePreset(modelAt(IMAGE_MODELS, 0), 2.5)

    registerPreset(preset)

    const response = await imageEstimate(
      new Request('http://localhost/api/images/estimate', {
        method: 'POST',
        headers: { host: 'localhost', 'content-type': 'application/json' },
        body: JSON.stringify({
          presetId: preset.id,
          count: 1,
          aspectRatio: preset.defaultAspectRatio,
          resolution: preset.defaultResolution,
          quality: preset.defaultQuality,
          background: preset.defaultBackground,
          references: [],
          promptChars: 5,
        }),
      }),
    )

    const body = (await response.json()) as { usd: number }

    expect(response.status).toBe(200)
    expect(body.usd).toBeCloseTo(2.5)
  })

  it('estimates a custom image preset with an optional zero-length prompt', async () => {
    const base = modelAt(IMAGE_MODELS, 0)

    const model: UpaiModel = {
      ...base,
      capabilities: {
        ...base.capabilities,
        prompt: { required: false, max_chars: 0 },
      },
    }

    const preset = imagePreset(model, 2.5)

    registerPreset(preset)

    const response = await imageEstimate(
      new Request('http://localhost/api/images/estimate', {
        method: 'POST',
        headers: { host: 'localhost', 'content-type': 'application/json' },
        body: JSON.stringify({
          presetId: preset.id,
          count: 1,
          aspectRatio: preset.defaultAspectRatio,
          resolution: preset.defaultResolution,
          quality: preset.defaultQuality,
          background: preset.defaultBackground,
          references: [],
          promptChars: 0,
        }),
      }),
    )

    const body = (await response.json()) as { usd: number }

    expect(response.status).toBe(200)
    expect(body.usd).toBeCloseTo(2.5)
  })

  it('rejects an invalid model entry', async () => {
    const preset = imagePreset(modelAt(INVALID_MODELS, 0), 0)

    registerPreset(preset, 'invalid', 'node class KSampler is not installed')

    await expect(loadCatalogEntry(preset.id)).rejects.toThrow(ValidationError)

    await expect(loadCatalogEntry(preset.id)).rejects.toThrow(
      'node class KSampler is not installed',
    )
  })

  it('still resolves static presets', async () => {
    expect((await findVideoPresetAny('wan-3.0'))?.id).toBe('wan-3.0')
    expect((await findImagePresetAny(IMAGE_PRESETS[0].id))?.id).toBe(IMAGE_PRESETS[0].id)
  })
})
