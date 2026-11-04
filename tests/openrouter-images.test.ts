import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ImageGenerateParams } from '@/server/providers/types'

import { IMAGE_PRESETS } from '../src/core/presets/image'
import type { ImagePreset } from '../src/core/presets/image/types'
import type { ImageGenerationInput } from '../src/core/schemas/image-record'

vi.mock('@/core/constants', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/core/constants')

  return { ...actual, MAX_PROVIDER_B64_CHARS: 4 }
})

vi.mock('@/server/secrets', () => {
  return {
    getSecret: () => {
      return 'test-key'
    },
  }
})

const { createOpenRouterImageProvider } = await import('@/server/providers/openrouter/images')

const PRESET: ImagePreset = { ...IMAGE_PRESETS[0], maxN: 4 }

function input(overrides: Partial<ImageGenerationInput> = {}): ImageGenerationInput {
  return {
    presetId: PRESET.id,
    prompt: 'a cat',
    count: 4,
    aspectRatio: '16:9',
    resolution: '1K',
    quality: null,
    background: null,
    references: [],
    seed: null,
    ...overrides,
  }
}

function params(overrides: Partial<ImageGenerateParams> = {}): ImageGenerateParams {
  return {
    preset: PRESET,
    input: input(),
    references: [{ id: 'ref-1', dataUrl: 'data:image/png;base64,AAAA' }],
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// eslint-disable-next-line max-lines-per-function -- provider cases stay in one suite
describe('openrouter image provider', () => {
  it('posts the preset, input and reference payloads', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      return jsonResponse({
        data: [{ b64_json: 'AA==', media_type: 'image/png' }],
        usage: { cost: 0.02 },
      })
    })

    vi.stubGlobal('fetch', fetchMock)

    const result = await createOpenRouterImageProvider().generate(params())

    expect(result).toEqual({
      items: [{ b64: 'AA==', mediaType: 'image/png' }],
      costUsd: 0.02,
    })

    const [url, init] = fetchMock.mock.calls[0] ?? []
    const body: unknown = JSON.parse(String(init?.body))

    expect(url).toBe('https://openrouter.ai/api/v1/images')
    expect(init?.method).toBe('POST')

    expect(body).toMatchObject({
      model: PRESET.bindings[0].modelId,
      prompt: 'a cat',
      n: 4,
      aspect_ratio: '16:9',
      resolution: '1K',
      input_references: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } }],
    })
  })

  it('omits auto aspect, refs and null controls', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      return jsonResponse({ data: [{ b64_json: 'AA==', media_type: 'image/webp' }] })
    })

    vi.stubGlobal('fetch', fetchMock)

    const result = await createOpenRouterImageProvider().generate(
      params({
        input: input({ aspectRatio: 'auto', resolution: null, count: 1 }),
        references: [],
      }),
    )

    const init = fetchMock.mock.calls[0]?.[1]
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>

    expect(body).not.toHaveProperty('aspect_ratio')
    expect(body).not.toHaveProperty('resolution')
    expect(body).not.toHaveProperty('input_references')
    expect(result.costUsd).toBeNull()
  })

  it('keeps valid images and cost when one item is invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => {
        return jsonResponse({
          data: [
            { b64_json: 'AA==', media_type: 'image/png' },
            { b64_json: 'BB==', media_type: 'image/svg+xml' },
            { media_type: 'image/png' },
            { b64_json: 'CC==', media_type: 'image/webp' },
          ],
          usage: { cost: 0.05 },
        })
      }),
    )

    const result = await createOpenRouterImageProvider().generate(params())

    expect(result.costUsd).toBe(0.05)

    expect(result.items).toEqual([
      { b64: 'AA==', mediaType: 'image/png' },
      { error: 'Unsupported image type: image/svg+xml' },
      { error: expect.stringContaining('Invalid image item') },
      { b64: 'CC==', mediaType: 'image/webp' },
    ])
  })

  it('rejects a base64 payload over the decode cap', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => {
        return jsonResponse({ data: [{ b64_json: 'AAAAA', media_type: 'image/png' }] })
      }),
    )

    const result = await createOpenRouterImageProvider().generate(params())

    expect(result.items).toEqual([{ error: 'Image is larger than the upload limit' }])
  })

  it('maps provider errors through the normalizer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => {
        return jsonResponse({ error: { message: 'Insufficient credits', code: '402' } }, 402)
      }),
    )

    await expect(createOpenRouterImageProvider().generate(params())).rejects.toMatchObject({
      kind: 'credits',
      status: 402,
    })
  })

  it('maps a timeout to the timeout kind', async () => {
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' })

    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => {
        throw timeout
      }),
    )

    await expect(createOpenRouterImageProvider().generate(params())).rejects.toMatchObject({
      kind: 'timeout',
    })
  })

  it('lists the live image models', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => {
        return jsonResponse({
          data: [
            {
              id: PRESET.bindings[0].modelId,
              supported_parameters: { n: { max: 4 } },
            },
          ],
        })
      }),
    )

    const list = await createOpenRouterImageProvider().listModels()

    expect(list.isFresh).toBe(true)
    expect(list.models[0]?.modelId).toBe(PRESET.bindings[0].modelId)
  })
})
