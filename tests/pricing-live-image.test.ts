import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadLivePricing } from '@/server/pricing/live'
import { registerOpenRouterPricing } from '@/server/providers/openrouter/pricing'

import { json, stubLive } from './helpers/image-models-live'

registerOpenRouterPricing()

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('OpenRouter image live adapter', () => {
  it('maps endpoint lines to SKU keys and keeps the highest rate', async () => {
    stubLive()

    const live = await loadLivePricing({
      provider: 'openrouter',
      kind: 'image',
      modelId: 'google/gemini-3-pro-image',
      fallback: {},
      isForce: true,
    })

    expect(live.source).toBe('live')
    expect(live.skus.output_image_base_image).toBe(0.01)
    expect(live.listSkus).toEqual(live.skus)
    expect(live.discountPct).toBe(0)
  })

  it('logs the spread in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input)

        if (url.endsWith('/endpoints')) {
          return json({
            data: {
              endpoints: [
                {
                  pricing: [
                    { billable: 'output_image', unit: 'image', cost_usd: 0.01, variant: null },
                  ],
                },
                {
                  pricing: [
                    { billable: 'output_image', unit: 'image', cost_usd: 0.02, variant: null },
                  ],
                },
              ],
            },
          })
        }

        return json({ data: [] })
      }),
    )

    const live = await loadLivePricing({
      provider: 'openrouter',
      kind: 'image',
      modelId: 'stub/spread-image',
      fallback: {},
      isForce: true,
    })

    expect(live.skus.output_image_base_image).toBe(0.02)
    expect(warn).toHaveBeenCalled()
    expect(String(warn.mock.calls[0]?.[0])).toContain('spread')
  })

  it('falls back when the endpoint call fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response('down', { status: 503 })
      }),
    )

    const live = await loadLivePricing({
      provider: 'openrouter',
      kind: 'image',
      modelId: 'stub/down-image',
      fallback: { output_image_base_image: 0.5 },
      isForce: true,
    })

    expect(live.source).toBe('fallback')
    expect(live.skus.output_image_base_image).toBe(0.5)
  })
})
