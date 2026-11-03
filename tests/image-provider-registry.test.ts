import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ImageGenerateParams,
  ImageProvider,
  ImageResult,
  ProviderImageModel,
  ProviderImageModelList,
} from '@/server/providers/types'

const MODEL: ProviderImageModel = {
  modelId: 'fake-model',
  resolutions: ['1K'],
  aspectRatios: ['1:1'],
  qualities: null,
  backgrounds: null,
  maxN: 1,
  referenceMax: 0,
  hasSeed: null,
}

const MODELS: ProviderImageModelList = {
  models: [MODEL],
  isFresh: true,
}

/** Image provider that never touches the network. */
function createFake(): ImageProvider {
  return {
    id: 'openrouter',
    isConfigured: () => {
      return true
    },
    generate: async (_params: ImageGenerateParams): Promise<ImageResult> => {
      return { items: [{ b64: 'AA==', mediaType: 'image/png' }], costUsd: 0.01 }
    },
    listModels: async (): Promise<ProviderImageModelList> => {
      return MODELS
    },
    listEndpoints: async () => {
      return { state: 'present', reason: null }
    },
    testConnection: async () => {
      return { ok: true }
    },
  }
}

beforeEach(() => {
  const host = globalThis as Record<string, unknown>

  delete host.__upai_providers
  vi.resetModules()
})

describe('image provider registry', () => {
  it('shares a registration with a second module instance', async () => {
    const boot = await import('@/server/providers/registry')
    const fake = createFake()

    boot.registerImageProvider('openrouter', () => {
      return fake
    })

    vi.resetModules()

    const route = await import('@/server/providers/registry')

    expect(route.getImageProvider()).toBe(fake)
  })

  it('returns the registered instance and caches it', async () => {
    const registry = await import('@/server/providers/registry')
    const fake = createFake()

    registry.registerImageProvider('openrouter', () => {
      return fake
    })

    expect(registry.getImageProvider()).toBe(fake)
    expect(registry.getImageProvider()).toBe(fake)
  })

  it('replaces a cached instance when the provider is registered again', async () => {
    const registry = await import('@/server/providers/registry')
    const first = createFake()
    const second = createFake()

    registry.registerImageProvider('openrouter', () => {
      return first
    })

    registry.getImageProvider()

    registry.registerImageProvider('openrouter', () => {
      return second
    })

    expect(registry.getImageProvider()).toBe(second)
  })

  it('throws when no provider is registered', async () => {
    const registry = await import('@/server/providers/registry')

    expect(() => {
      return registry.getImageProvider()
    }).toThrow('[unplatform-ai] no image provider registered for openrouter')
  })
})
