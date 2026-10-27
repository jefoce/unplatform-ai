import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getPreset } from '@/core/presets'
import { getProviderAccount } from '@/server/providers/openrouter/account'
import { JobSchema, SubmitSchema } from '@/server/providers/openrouter/http'
import { fetchDiscount, getPricing } from '@/server/providers/openrouter/pricing'
import { createOpenRouterProvider } from '@/server/providers/openrouter/provider'
import { fetchVideoModelsResult } from '@/server/providers/openrouter/video-models'
import { __setSecretsBackendForTests, setSecrets } from '@/server/secrets'

import { memoryBackend } from './helpers/secrets'

const WAN = getPreset('wan-3.0')

const WAN_SKUS = {
  duration_seconds_480p: '0.05',
  duration_seconds_720p: '0.1',
  duration_seconds_1080p: '0.2',
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

interface StubModelsParams {
  body?: unknown
  discount?: unknown
  modelsStatus?: number
}

function stubModels(params: StubModelsParams = {}): void {
  const { body = { data: [] }, discount = 0.15, modelsStatus = 200 } = params

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input)

      if (url.endsWith('/endpoints')) {
        return jsonResponse({ data: { endpoints: [{ pricing: { discount } }] } })
      }

      if (modelsStatus !== 200) {
        return new Response('unavailable', { status: modelsStatus })
      }

      return jsonResponse(body)
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('model list fallbacks', () => {
  it('prices Wan when one model entry is malformed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    stubModels({
      body: {
        data: [{ id: 42 }, { id: 'alibaba/wan-3.0', pricing_skus: WAN_SKUS }],
      },
      discount: 0.15,
    })

    const info = await getPricing(WAN, true)

    expect(info).toMatchObject({ source: 'live', discount: 0.15 })

    expect(info.skus).toEqual({
      duration_seconds_480p: 0.0425,
      duration_seconds_720p: 0.085,
      duration_seconds_1080p: 0.17,
    })

    expect(warn).toHaveBeenCalledTimes(1)

    expect(String(warn.mock.calls[0]?.[0])).toBe(
      '[pricing] skipped 1 video models with unexpected fields',
    )
  })

  it('falls back and warns when the Wan entry is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    stubModels({ body: { data: [{ id: 'other/model', pricing_skus: WAN_SKUS }] } })

    const info = await getPricing(WAN, true)

    expect(info).toMatchObject({ source: 'fallback', discount: 0 })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('model missing')
  })

  it('falls back with the HTTP status when the models call fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    stubModels({ modelsStatus: 503 })

    const info = await getPricing(WAN, true)

    expect(info).toMatchObject({ source: 'fallback', discount: 0 })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('HTTP 503')
  })
})

describe('null fields', () => {
  it('parses null job and submit fields', () => {
    const job = JobSchema.safeParse({
      id: 'job-1',
      status: 'completed',
      generation_id: null,
      unsigned_urls: null,
      urls: null,
      expires_at: null,
      usage: { cost: null, is_byok: null },
      error: null,
    })

    expect(job.success).toBe(true)

    const submit = SubmitSchema.safeParse({
      id: 'job-1',
      status: 'pending',
      polling_url: null,
    })

    expect(submit.success).toBe(true)
  })

  it('parses null model fields and keeps the model', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return jsonResponse({
          data: [
            {
              id: 'alibaba/wan-3.0',
              supported_durations: null,
              supported_resolutions: null,
              supported_aspect_ratios: null,
              supported_frame_images: null,
              generate_audio: null,
              seed: null,
            },
          ],
        })
      }),
    )

    const result = await fetchVideoModelsResult(true)

    expect(result.reason).toBeNull()
    expect(result.models).toHaveLength(1)
  })

  it('parses a null endpoint pricing block', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return jsonResponse({ data: { endpoints: [{ pricing: null }] } })
      }),
    )

    await expect(fetchDiscount(WAN)).resolves.toBe(0)
    expect(warn).toHaveBeenCalledTimes(1)

    const text = String(warn.mock.calls[0]?.[0])

    expect(text).toContain('no pricing block')
    expect(text).not.toContain('out of range')
  })

  it('warns when the endpoint list is empty', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return jsonResponse({ data: { endpoints: [] } })
      }),
    )

    await expect(fetchDiscount(WAN)).resolves.toBe(0)
    expect(warn).toHaveBeenCalledTimes(1)

    const text = String(warn.mock.calls[0]?.[0])

    expect(text).toContain('no pricing block')
    expect(text).not.toContain('out of range')
  })
})

describe('key response null fields', () => {
  beforeEach(async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '')
    vi.stubEnv('OPENROUTER_MANAGEMENT_KEY', '')

    __setSecretsBackendForTests(memoryBackend({ OPENROUTER_API_KEY: 'key-a' }))
    await setSecrets({ OPENROUTER_API_KEY: 'key-a' })
  })

  it('parses a null key label', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return jsonResponse({ data: { label: null } })
      }),
    )

    await expect(createOpenRouterProvider().testConnection()).resolves.toEqual({ ok: true })
  })

  it('parses null key limits', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return jsonResponse({
          data: {
            limit: null,
            limit_remaining: null,
            usage_daily: null,
            usage_monthly: null,
          },
        })
      }),
    )

    const account = await getProviderAccount({ fresh: true })

    expect(account).toMatchObject({
      keyLimit: null,
      keyLimitRemaining: null,
      usageDaily: null,
      usageMonthly: null,
      error: null,
    })
  })
})
