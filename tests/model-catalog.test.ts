import { isNil } from 'lodash-es'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MODEL_PRESETS } from '@/core/presets'
import { activeBinding, primaryBinding } from '@/core/presets/bindings'
import type { ModelPreset } from '@/core/presets/types'
import type { VideoProviderId } from '@/core/providers/types'
import { listModels as mockListModels } from '@/server/providers/mock/models'
import type { ProviderModel, ProviderModelList } from '@/server/providers/types'
import { getModelCatalog } from '@/server/services/model-catalog'

const multi = vi.hoisted(() => {
  return {
    id: 'multi-binding',
    laterModel: 'later/model',
    fakeProvider: 'fake' as VideoProviderId,
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

  return {
    getPricing: vi.fn(async () => {
      return pricing
    }),
    isConfigured: vi.fn((_id: string): boolean => {
      return true
    }),
    listModels: vi.fn(async (): Promise<ProviderModelList> => {
      return { models: [], isFresh: true }
    }),
  }
})

vi.mock('@/core/presets', async (importOriginal) => {
  const actual = await importOriginal<{ MODEL_PRESETS: readonly ModelPreset[] }>()
  const base = actual.MODEL_PRESETS[0]

  if (isNil(base)) {
    throw new Error('base preset is missing')
  }

  const later = { ...base.bindings[0], provider: multi.fakeProvider, modelId: multi.laterModel }
  const preset: ModelPreset = { ...base, id: multi.id, bindings: [base.bindings[0], later] }

  return { ...actual, MODEL_PRESETS: [...actual.MODEL_PRESETS, preset] }
})

vi.mock('@/core/providers/registry', () => {
  return {
    videoProviderDescriptor: (id: string) => {
      return { id, label: 'OpenRouter' }
    },
  }
})

vi.mock('@/server/providers/registry', () => {
  return {
    getVideoProvider: (id: string) => {
      return {
        getPricing: mocks.getPricing,
        isConfigured: () => {
          return mocks.isConfigured(id)
        },
        listModels: mocks.listModels,
      }
    },
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
  return MODEL_PRESETS.map((preset) => {
    return model(primaryBinding(preset).modelId)
  })
}

beforeEach(() => {
  mocks.getPricing.mockClear()
  mocks.isConfigured.mockReset()
  mocks.isConfigured.mockReturnValue(true)
  mocks.listModels.mockReset()
  mocks.listModels.mockResolvedValue({ models: [], isFresh: true })
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

  it('marks an absent model as missing with the provider label', async () => {
    mocks.listModels.mockResolvedValue({ models: [model('other/model')], isFresh: true })

    const { entries } = await getModelCatalog()

    expect(
      entries.every((entry) => {
        return entry.status === 'missing'
      }),
    ).toBe(true)

    expect(entries[0]?.reason).toBe('Not available on OpenRouter right now.')
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
    mocks.listModels.mockResolvedValue(await mockListModels())

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
    const preset = MODEL_PRESETS.find((item) => {
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
    const preset = MODEL_PRESETS.find((item) => {
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
