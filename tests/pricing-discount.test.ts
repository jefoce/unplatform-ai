import { afterEach, describe, expect, it, vi } from 'vitest'

import { getPreset } from '@/core/presets'
import { getPricing } from '@/server/openrouter/pricing'

const WAN_SKUS = {
  duration_seconds_480p: '0.05',
  duration_seconds_720p: '0.1',
  duration_seconds_1080p: '0.2',
}

const response = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

function stubFetch(
  discount: unknown,
  options: {
    endpointsFail?: boolean
    modelsFail?: boolean
    id?: string
    skus?: Record<string, string>
  } = {},
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input)

      if (url.endsWith('/endpoints')) {
        if (options.endpointsFail === true) throw new Error('endpoints down')

        return response({ data: { endpoints: [{ pricing: { discount } }] } })
      }

      if (options.modelsFail === true) throw new Error('models down')

      return response({
        data: [{ id: options.id ?? 'alibaba/wan-3.0', pricing_skus: options.skus ?? WAN_SKUS }],
      })
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('getPricing discounts', () => {
  it('scales list prices by the live discount', async () => {
    vi.stubEnv('OPENROUTER_MOCK', '')
    stubFetch(0.15)

    const info = await getPricing(getPreset('wan-3.0'), true)

    expect(info).toMatchObject({ source: 'live', discount: 0.15 })
    expect(info.skus).toEqual({
      duration_seconds_480p: 0.0425,
      duration_seconds_720p: 0.085,
      duration_seconds_1080p: 0.17,
    })
    expect(info.listSkus).toEqual({
      duration_seconds_480p: 0.05,
      duration_seconds_720p: 0.1,
      duration_seconds_1080p: 0.2,
    })
    expect(Object.keys(info).sort()).toEqual([
      'discount',
      'fetchedAt',
      'listSkus',
      'skus',
      'source',
    ])
  })

  it('keeps Seedance token precision after a discount', async () => {
    vi.stubEnv('OPENROUTER_MOCK', '')
    stubFetch(0.15, {
      id: 'bytedance/seedance-2.0',
      skus: { video_tokens: '0.0000043', video_tokens_sd: '0.000007' },
    })

    const info = await getPricing(getPreset('seedance-2.0'), true)

    expect(info.skus.video_tokens).toBeCloseTo(0.000003655, 12)
    expect(info.skus.video_tokens_sd).toBeCloseTo(0.00000595, 12)
  })

  it('keeps list prices when the discount is 0', async () => {
    vi.stubEnv('OPENROUTER_MOCK', '')
    stubFetch(0)

    const info = await getPricing(getPreset('wan-3.0'), true)

    expect(info.discount).toBe(0)
    expect(info.skus).toEqual(info.listSkus)
  })

  it.each([['0.15'], [2], [-0.1], [null], [undefined]])(
    'treats invalid discount %j as 0',
    async (discount) => {
      vi.stubEnv('OPENROUTER_MOCK', '')
      stubFetch(discount)

      const info = await getPricing(getPreset('wan-3.0'), true)

      expect(info.discount).toBe(0)
      expect(info.skus).toEqual(info.listSkus)
    },
  )

  it('keeps live list prices when the endpoints call fails', async () => {
    vi.stubEnv('OPENROUTER_MOCK', '')
    stubFetch(0.15, { endpointsFail: true })

    const info = await getPricing(getPreset('wan-3.0'), true)

    expect(info).toMatchObject({ source: 'live', discount: 0 })
    expect(info.skus).toEqual(info.listSkus)
  })

  it('falls back without throwing when the models call fails', async () => {
    vi.stubEnv('OPENROUTER_MOCK', '')
    stubFetch(0.15, { modelsFail: true })

    const info = await getPricing(getPreset('wan-3.0'), true)

    expect(info).toMatchObject({ source: 'fallback', discount: 0 })
    expect(info.skus).toEqual(getPreset('wan-3.0').pricing.fallback)
    expect(info.listSkus).toEqual(info.skus)
  })
})
