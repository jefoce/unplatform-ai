import { describe, expect, it, vi } from 'vitest'

describe('live pricing registry', () => {
  it('finds a loader registered by another module instance', async () => {
    const first = await import('@/server/pricing/live')

    const loader = vi.fn(async () => {
      return {
        skus: { live_rate: 1 },
        listSkus: { live_rate: 1 },
        discountPct: 0,
        source: 'live' as const,
      }
    })

    first.registerLivePricing({ provider: 'openrouter', kind: 'video', loader })

    vi.resetModules()

    const second = await import('@/server/pricing/live')

    const live = await second.loadLivePricing({
      provider: 'openrouter',
      kind: 'video',
      modelId: 'stub/model',
      fallback: { fallback_rate: 9 },
    })

    expect(live.source).toBe('live')
    expect(live.skus).toEqual({ live_rate: 1 })
    expect(loader).toHaveBeenCalledOnce()
  })
})
