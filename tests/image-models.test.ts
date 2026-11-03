import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  fetchImageEndpoints,
  fetchImageEndpointsResult,
  fetchImageModelList,
  fetchImageModelsResult,
  registerImageModelsSecretsListener,
} from '@/server/providers/openrouter/images-models'

import { IMAGE_PRESETS } from '../src/core/presets/image'
import { GEMINI_21, json, liveParamKeys, modelEntry, stubLive } from './helpers/image-models-live'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('image models list', () => {
  it('parses every entry and reports a fresh list', async () => {
    stubLive()

    const list = await fetchImageModelList(true)

    expect(list.isFresh).toBe(true)
    expect(list.models).toHaveLength(12)

    const pro = list.models.find((model) => {
      return model.modelId === 'google/gemini-3-pro-image'
    })

    expect(pro).toMatchObject({ maxN: 1, referenceMax: 14, hasSeed: false })
    expect(pro?.resolutions).toEqual(['1K', '2K', '4K'])
  })

  it('skips one malformed entry and keeps the rest', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return json({ data: [{ id: 42 }, modelEntry(GEMINI_21)] })
      }),
    )

    const list = await fetchImageModelList(true)

    expect(list.models).toHaveLength(1)
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

type ListKey = 'resolutions' | 'aspectRatios' | 'qualities' | 'backgrounds'

type Endpoints = Awaited<ReturnType<typeof fetchImageEndpoints>>

function hasValue(endpoints: Endpoints, key: ListKey, value: string): boolean {
  return endpoints.some((endpoint) => {
    return endpoint.model[key]?.includes(value) ?? false
  })
}

function maxOf(endpoints: Endpoints, key: 'maxN' | 'referenceMax'): number {
  return Math.max(
    ...endpoints.map((endpoint) => {
      return endpoint.model[key] ?? 0
    }),
  )
}

function expectResolutions(
  endpoints: Endpoints,
  presetId: string,
  values: readonly string[],
): void {
  for (const value of values) {
    expect(hasValue(endpoints, 'resolutions', value), presetId).toBe(true)
  }
}

function expectRatios(endpoints: Endpoints, presetId: string, ratios: readonly string[]): void {
  for (const ratio of ratios) {
    expect(hasValue(endpoints, 'aspectRatios', ratio), presetId).toBe(true)
  }
}

function expectOptions(
  endpoints: Endpoints,
  presetId: string,
  key: 'qualities' | 'backgrounds',
  values: readonly string[],
): void {
  for (const value of values) {
    expect(hasValue(endpoints, key, value), presetId).toBe(true)
  }
}

describe('image endpoints contract', () => {
  it('supports every preset value on at least one endpoint', async () => {
    stubLive()

    for (const preset of IMAGE_PRESETS) {
      const endpoints = await fetchImageEndpoints(preset.bindings[0].modelId, true)

      const resolutions = (preset.resolutions ?? []).map((option) => {
        return option.value
      })

      const qualities = (preset.qualities ?? []).map((option) => {
        return option.value
      })

      const backgrounds = (preset.backgrounds ?? []).map((option) => {
        return option.value
      })

      expect(endpoints.length, preset.id).toBeGreaterThan(0)

      expectResolutions(endpoints, preset.id, resolutions)
      expectRatios(endpoints, preset.id, preset.aspectRatios)
      expectOptions(endpoints, preset.id, 'qualities', qualities)
      expectOptions(endpoints, preset.id, 'backgrounds', backgrounds)
    }
  })

  it('keeps counts and references inside the live ranges', async () => {
    stubLive()

    for (const preset of IMAGE_PRESETS) {
      const endpoints = await fetchImageEndpoints(preset.bindings[0].modelId, true)

      expect(preset.maxN, preset.id).toBeLessThanOrEqual(maxOf(endpoints, 'maxN'))
      expect(preset.referenceMax, preset.id).toBeLessThanOrEqual(maxOf(endpoints, 'referenceMax'))
    }
  })
})

describe('image parameter contract', () => {
  it('declares only parameters the live model supports', () => {
    for (const preset of IMAGE_PRESETS) {
      const keys = liveParamKeys(preset.bindings[0].modelId)

      for (const param of preset.params) {
        expect(keys, `${preset.id} ${param}`).toContain(param)
      }
    }
  })
})

describe('image models fallback', () => {
  it('warns once and returns an empty list without throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response('down', { status: 503 })
      }),
    )

    const list = await fetchImageModelList(true)
    const result = await fetchImageModelsResult(true)
    const endpoints = await fetchImageEndpointsResult('google/gemini-3-pro-image', true)

    expect(list).toEqual({ models: [], isFresh: false })
    expect(result.reason).toBe('HTTP 503')
    expect(endpoints.reason).toBe('HTTP 503')
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('registers the secrets listener', () => {
    expect(() => {
      registerImageModelsSecretsListener()
    }).not.toThrow()
  })
})

describe('image endpoint pricing', () => {
  it('reads lines and keeps the variant', async () => {
    stubLive()

    const endpoints = await fetchImageEndpoints('google/gemini-3-pro-image', true)
    const line = endpoints[0]?.lines[0]

    expect(
      endpoints.map((endpoint) => {
        return endpoint.name
      }),
    ).toEqual(['vertex', 'google'])

    expect(line).toEqual({
      billable: 'output_image',
      unit: 'image',
      costUsd: 0.01,
      variant: null,
    })
  })
})
