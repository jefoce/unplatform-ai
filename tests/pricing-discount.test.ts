import { readFile } from 'node:fs/promises'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { getPreset } from '@/core/presets'
import { primaryBinding } from '@/core/presets/bindings'
import { pricePerSec } from '@/core/pricing'
import type { Dict } from '@/core/utility-types'
import { fetchDiscount, getPricing } from '@/server/providers/openrouter/pricing'

const WAN_SKUS = {
  duration_seconds_480p: '0.05',
  duration_seconds_720p: '0.1',
  duration_seconds_1080p: '0.2',
}

const response = (body: unknown): Response => {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

async function fixture(name: string): Promise<unknown> {
  const text = await readFile(new URL(`./fixtures/openrouter/${name}`, import.meta.url), 'utf8')
  const parsed: unknown = JSON.parse(text)

  return parsed
}

function stubEndpoints(body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      return response(body)
    }),
  )
}

function stubFetch(
  discount: unknown,
  options: {
    endpointsFail?: boolean
    modelsFail?: boolean
    id?: string
    skus?: Dict<string>
  } = {},
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input)

      if (url.endsWith('/endpoints')) {
        if (options.endpointsFail === true) {
          throw new Error('endpoints down')
        }

        return response({ data: { endpoints: [{ pricing: { discount } }] } })
      }

      if (options.modelsFail === true) {
        throw new Error('models down')
      }

      return response({
        data: [
          // The live list sends null for fields a model does not use.
          { id: 'example/no-options', supported_durations: null, generate_audio: null },
          { id: options.id ?? 'alibaba/wan-3.0', pricing_skus: options.skus ?? WAN_SKUS },
        ],
      })
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('fetchDiscount', () => {
  it('reads the live fraction from the captured Wan 3.0 response', async () => {
    stubEndpoints(await fixture('wan-3.0-endpoints.json'))

    await expect(fetchDiscount(getPreset('wan-3.0'))).resolves.toBe(0.15)
  })

  it('warns once and returns 0 for a malformed discount', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
      return
    })

    stubEndpoints(await fixture('wan-3.0-endpoints-malformed.json'))

    await expect(fetchDiscount(getPreset('wan-3.0'))).resolves.toBe(0)

    expect(warn).toHaveBeenCalledTimes(1)

    const text = String(warn.mock.calls[0]?.[0])

    expect(text).toContain('wan-3.0')
    expect(text).toContain('alibaba/wan-3.0')
    expect(text).toContain('invalid response')
  })

  it('warns with the HTTP status on a non-200 response', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
      return
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response('unavailable', { status: 503 })
      }),
    )

    await expect(fetchDiscount(getPreset('wan-3.0'))).resolves.toBe(0)

    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('HTTP 503')
  })
})

describe('Wan discounted prices', () => {
  it('prices every SKU 15 percent below list', async () => {
    vi.stubEnv('OPENROUTER_MOCK', '')
    stubFetch(0.15)

    const preset = getPreset('wan-3.0')
    const info = await getPricing(preset, true)

    const rows = [
      { resolution: '480p', listRate: 0.05 },
      { resolution: '720p', listRate: 0.1 },
      { resolution: '1080p', listRate: 0.2 },
    ] as const

    for (const row of rows) {
      const ctx = {
        resolution: row.resolution,
        aspect: '16:9',
        audio: true,
        hasVideoInput: false,
      } as const

      expect(pricePerSec({ preset, ctx, skus: info.listSkus })).toBeCloseTo(row.listRate, 12)
      expect(pricePerSec({ preset, ctx, skus: info.skus })).toBeCloseTo(row.listRate * 0.85, 12)
    }
  })
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
    expect(info.skus).toEqual(primaryBinding(getPreset('wan-3.0')).pricing.fallback)
    expect(info.listSkus).toEqual(info.skus)
  })
})
