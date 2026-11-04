import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ImageGenerateParams } from '@/server/providers/types'

import { IMAGE_OUTPUT_MAX_BYTES } from '../src/core/constants'
import { IMAGE_PRESETS } from '../src/core/presets/image'
import type { ImagePreset } from '../src/core/presets/image/types'
import type { ImageGenerationInput } from '../src/core/schemas/image-record'

vi.mock('@/server/secrets', () => {
  return {
    getSecret: () => {
      return 'test-key'
    },
  }
})

const { createOpenRouterImageProvider } = await import('@/server/providers/openrouter/images')

const PRESET: ImagePreset = IMAGE_PRESETS[0]
const OVERHEAD_BYTES = 64 * 1024

function params(): ImageGenerateParams {
  const input: ImageGenerationInput = {
    presetId: PRESET.id,
    prompt: 'a cat',
    count: 1,
    aspectRatio: 'auto',
    resolution: null,
    quality: null,
    background: null,
    references: [],
    seed: null,
  }

  return { preset: PRESET, input, references: [] }
}

function responseWithBase64(chars: number): Response {
  return new Response(
    JSON.stringify({ data: [{ b64_json: 'A'.repeat(chars), media_type: 'image/png' }] }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('image response cap', () => {
  it('rejects a valid body above the output estimate as charged_unknown', async () => {
    const cap = Math.ceil((IMAGE_OUTPUT_MAX_BYTES * 4) / 3) + OVERHEAD_BYTES
    const chars = cap + 2 * 1024 * 1024

    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => {
        return responseWithBase64(chars)
      }),
    )

    await expect(createOpenRouterImageProvider().generate(params())).rejects.toMatchObject({
      name: 'ProviderError',
      kind: 'charged_unknown',
      status: 200,
    })
  })

  it('accepts a 4K-sized body under the output cap', async () => {
    const chars = 12 * 1024 * 1024

    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => {
        return responseWithBase64(chars)
      }),
    )

    const result = await createOpenRouterImageProvider().generate(params())

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).not.toHaveProperty('error')
  })
})
