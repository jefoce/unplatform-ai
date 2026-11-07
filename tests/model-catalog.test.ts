/* eslint-disable max-lines -- catalog cases share one mock registry */
import { isNil } from 'lodash-es'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listModels as mockListModels } from '@/server/providers/mock/models'
import type { EndpointSignal, ProviderModel, ProviderModelList } from '@/server/providers/types'
import { clearModelCatalog, getModelCatalog } from '@/server/services/model-catalog'

import { VIDEO_PRESETS } from '../src/core/presets'
import { activeBinding, primaryBinding } from '../src/core/presets/common/bindings'
import { IMAGE_PRESETS } from '../src/core/presets/image'
import type { VideoPreset } from '../src/core/presets/video/types'
import type { ProviderKindId } from '../src/core/providers/types'

vi.hoisted(() => {
  const os = process.getBuiltinModule('node:os')

  process.env.STORAGE_ROOT = `${os.tmpdir()}/cf-model-catalog-${process.pid}`
})

const multi = vi.hoisted(() => {
  return {
    id: 'multi-binding',
    laterModel: 'later/model',
    fakeProvider: 'fake' as ProviderKindId,
  }
})

const mocks = vi.hoisted(() => {
  const pricing = {
    skus: {},
    listSkus: {},
    discount: 0,
    source: 'live' as const,
    fetchedAt: '',
  }

  const state = {
    getPricing: vi.fn(async () => {
      return pricing
    }),
    isConfigured: vi.fn((_id: string): boolean => {
      return true
    }),
    listModels: vi.fn(async (): Promise<ProviderModelList> => {
      return { models: [], isFresh: true }
    }),
    listEndpoints: vi.fn(async (): Promise<EndpointSignal> => {
      return { state: 'unknown', reason: 'not checked' }
    }),
  }

  const provider = (id: string) => {
    return {
      id,
      getPricing: state.getPricing,
      isConfigured: () => {
        return state.isConfigured(id)
      },
      listModels: state.listModels,
      listEndpoints: state.listEndpoints,
    }
  }

  return { ...state, provider }
})

vi.mock('@/core/presets', async (importOriginal) => {
  const actual = await importOriginal<{ VIDEO_PRESETS: readonly VideoPreset[] }>()
  const base = actual.VIDEO_PRESETS[0]

  if (isNil(base)) {
    throw new Error('base preset is missing')
  }

  const later = { ...base.bindings[0], provider: multi.fakeProvider, modelId: multi.laterModel }
  const preset: VideoPreset = { ...base, id: multi.id, bindings: [base.bindings[0], later] }

  return { ...actual, VIDEO_PRESETS: [...actual.VIDEO_PRESETS, preset] }
})

vi.mock('@/core/providers/registry', () => {
  return {
    providerDescriptor: (id: string) => {
      return { id, label: 'OpenRouter' }
    },
  }
})

vi.mock('@/server/providers/registry', () => {
  return {
    getImageProvider: mocks.provider,
    getVideoProvider: mocks.provider,
  }
})

vi.mock('@/server/secrets', () => {
  return {
    secretsReady: vi.fn(async () => {}),
  }
})

function model(modelId: string): ProviderModel {
  return {
    modelId,
    durations: null,
    resolutions: null,
    aspectRatios: null,
    frameImages: null,
    generatesAudio: null,
    hasSeed: null,
  }
}

const allPresetModels = (): ProviderModel[] => {
  return [
    ...VIDEO_PRESETS.map((preset) => {
      return model(primaryBinding(preset).modelId)
    }),
    ...IMAGE_PRESETS.map((preset) => {
      return model(preset.bindings[0].modelId)
    }),
  ]
}

beforeEach(() => {
  clearModelCatalog()
  mocks.getPricing.mockClear()
  mocks.isConfigured.mockReset()
  mocks.isConfigured.mockReturnValue(true)
  mocks.listModels.mockReset()
  mocks.listModels.mockResolvedValue({ models: [], isFresh: true })
  mocks.listEndpoints.mockReset()
  mocks.listEndpoints.mockResolvedValue({ state: 'unknown', reason: 'not checked' })
})

describe('getModelCatalog status', () => {
  it('marks a model present in the live list as available', async () => {
    mocks.listModels.mockResolvedValue({ models: allPresetModels(), isFresh: true })

    const { entries } = await getModelCatalog()

    expect(
      entries.every((entry) => {
        return entry.status === 'available'
      }),
    ).toBe(true)

    expect(
      entries.every((entry) => {
        return entry.reason === null
      }),
    ).toBe(true)
  })

  it('marks an absent model with no endpoints as missing with the provider label', async () => {
    mocks.listModels.mockResolvedValue({ models: [model('other/model')], isFresh: true })
    mocks.listEndpoints.mockResolvedValue({ state: 'not_found', reason: 'HTTP 404' })

    const { entries } = await getModelCatalog()

    expect(
      entries.every((entry) => {
        return entry.status === 'missing'
      }),
    ).toBe(true)

    expect(entries[0]?.reason).toBe('Not available on OpenRouter right now.')
  })

  it('marks an absent model with endpoints as unverified', async () => {
    mocks.listModels.mockResolvedValue({ models: [model('other/model')], isFresh: true })
    mocks.listEndpoints.mockResolvedValue({ state: 'present', reason: null })

    const { entries } = await getModelCatalog()

    expect(
      entries.every((entry) => {
        return entry.status === 'unverified'
      }),
    ).toBe(true)
  })

  it('marks a fresh but empty list as unverified without a reason', async () => {
    const { entries } = await getModelCatalog()

    expect(
      entries.every((entry) => {
        return entry.status === 'unverified'
      }),
    ).toBe(true)

    expect(
      entries.every((entry) => {
        return entry.reason === null
      }),
    ).toBe(true)
  })

  it('marks a failed list as unverified even when it carries cached models', async () => {
    mocks.listModels.mockResolvedValue({ models: allPresetModels(), isFresh: false })

    const { entries } = await getModelCatalog()

    expect(
      entries.every((entry) => {
        return entry.status === 'unverified'
      }),
    ).toBe(true)

    expect(
      entries.every((entry) => {
        return entry.reason === null
      }),
    ).toBe(true)
  })
})

describe('getModelCatalog providers', () => {
  it('marks every model no_provider when no key is configured', async () => {
    mocks.isConfigured.mockReturnValue(false)

    const { entries } = await getModelCatalog()

    expect(
      entries.every((entry) => {
        return entry.status === 'no_provider'
      }),
    ).toBe(true)

    expect(entries[0]?.reason).toBe('Add your OpenRouter key in Settings.')
    expect(mocks.listModels).not.toHaveBeenCalled()
  })

  it('marks every model available from the mock adapter list', async () => {
    const mockModels = await mockListModels()

    mocks.listModels.mockResolvedValue({
      models: [...mockModels.models, ...allPresetModels()],
      isFresh: true,
    })

    const { entries } = await getModelCatalog()

    expect(
      entries.every((entry) => {
        return entry.status === 'available'
      }),
    ).toBe(true)

    expect(
      entries.every((entry) => {
        return entry.reason === null
      }),
    ).toBe(true)
  })

  it('includes every image preset in the catalog', async () => {
    const { entries } = await getModelCatalog()

    for (const preset of IMAGE_PRESETS) {
      expect(
        entries.some((entry) => {
          return entry.presetId === preset.id
        }),
        preset.id,
      ).toBe(true)
    }
  })

  it('uses a configured later binding for the catalog entry', async () => {
    mocks.isConfigured.mockImplementation((id) => {
      return id === multi.fakeProvider
    })

    mocks.listModels.mockResolvedValue({ models: [model(multi.laterModel)], isFresh: true })

    const { entries } = await getModelCatalog()

    const entry = entries.find((item) => {
      return item.presetId === multi.id
    })

    expect(entry?.modelId).toBe(multi.laterModel)
    expect(entry?.provider).toBe(multi.fakeProvider)
    expect(entry?.status).toBe('available')
  })
})

describe('activeBinding', () => {
  it('returns the first configured binding', () => {
    const preset = VIDEO_PRESETS.find((item) => {
      return item.id === multi.id
    })

    if (isNil(preset)) {
      throw new Error('multi-binding preset is missing')
    }

    const binding = activeBinding(preset, (item) => {
      return item.provider === multi.fakeProvider
    })

    expect(binding.modelId).toBe(multi.laterModel)
  })

  it('falls back to the primary binding when none is configured', () => {
    const preset = VIDEO_PRESETS.find((item) => {
      return item.id === multi.id
    })

    if (isNil(preset)) {
      throw new Error('multi-binding preset is missing')
    }

    const binding = activeBinding(preset, () => {
      return false
    })

    expect(binding.modelId).toBe(primaryBinding(preset).modelId)
  })
})
