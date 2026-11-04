import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadLivePricing, registerLivePricing } from '@/server/pricing/live'

const FALLBACK = { output_image_base_image: 0.42 } as const

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

function stubNetwork() {
  const fetchSpy = vi.fn(async (input: string | URL | Request) => {
    throw new Error(`unexpected fetch ${String(input)}`)
  })

  vi.stubGlobal('fetch', fetchSpy)

  return fetchSpy
}

describe('loadLivePricing mock mode', () => {
  it('returns the fallback table and never touches the loader', async () => {
    vi.stubEnv('OPENROUTER_MOCK', '1')
    const fetchSpy = stubNetwork()

    const loader = vi.fn(async () => {
      return {
        skus: { output_image_base_image: 9 },
        listSkus: { output_image_base_image: 9 },
        discountPct: 10,
        source: 'live' as const,
      }
    })

    registerLivePricing({ provider: 'openrouter', kind: 'image', loader })

    const live = await loadLivePricing({
      provider: 'openrouter',
      kind: 'image',
      modelId: 'stub/model',
      fallback: FALLBACK,
    })

    expect(live.source).toBe('fallback')
    expect(live.skus).toEqual(FALLBACK)
    expect(live.listSkus).toEqual(FALLBACK)
    expect(live.discountPct).toBe(0)
    expect(loader).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('runs the loader when mock mode is off', async () => {
    vi.stubEnv('OPENROUTER_MOCK', '0')
    stubNetwork()

    const loader = vi.fn(async () => {
      return {
        skus: { output_image_base_image: 9 },
        listSkus: { output_image_base_image: 9 },
        discountPct: 10,
        source: 'live' as const,
      }
    })

    registerLivePricing({ provider: 'openrouter', kind: 'image', loader })

    const live = await loadLivePricing({
      provider: 'openrouter',
      kind: 'image',
      modelId: 'stub/model',
      fallback: FALLBACK,
    })

    expect(live.source).toBe('live')
    expect(live.skus).toEqual({ output_image_base_image: 9 })
    expect(loader).toHaveBeenCalledOnce()
  })
})
