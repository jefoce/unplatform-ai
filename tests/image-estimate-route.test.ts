import { afterEach, describe, expect, it, vi } from 'vitest'

import * as imageValidation from '@/core/validation/image'

import { imagePreset } from './helpers/image-presets'

vi.mock('@/server/session', () => {
  return {
    hasSession: () => {
      return true
    },
  }
})

const { POST } = await import('@/app/api/images/estimate/route')

afterEach(() => {
  vi.restoreAllMocks()
})

const PRESET = imagePreset('gemini-nano-banana-2.1')

function request(body: unknown): Request {
  return new Request('http://localhost/api/images/estimate', {
    method: 'POST',
    headers: { host: 'localhost', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const BODY = {
  presetId: PRESET.id,
  count: 1,
  aspectRatio: PRESET.defaultAspectRatio,
  resolution: PRESET.defaultResolution,
  quality: PRESET.defaultQuality,
  background: PRESET.defaultBackground,
  references: [],
  seed: null,
  promptChars: 5,
}

describe('image estimate route', () => {
  it('returns the price for a valid draft', async () => {
    const response = await POST(request(BODY))
    const body = (await response.json()) as { usd: number; perImageUsd: number }

    expect(response.status).toBe(200)
    expect(body.usd).toBeCloseTo(body.perImageUsd)
  })

  it('prices an empty prompt', async () => {
    const response = await POST(request({ ...BODY, promptChars: 0 }))
    const body = (await response.json()) as { usd: number; perImageUsd: number }

    expect(response.status).toBe(200)
    expect(body.usd).toBeCloseTo(body.perImageUsd)
  })

  it('rejects an unknown preset', async () => {
    const response = await POST(request({ ...BODY, presetId: 'missing' }))

    expect(response.status).toBe(400)
  })

  it('clamps prompt chars to the preset limit in the quote', async () => {
    vi.spyOn(imageValidation, 'validateImageInput').mockReturnValue([])

    const preset = imagePreset('gpt-image-2')

    const base = {
      presetId: preset.id,
      count: 1,
      aspectRatio: preset.defaultAspectRatio,
      resolution: preset.defaultResolution,
      quality: preset.defaultQuality,
      background: null,
      references: [],
      seed: null,
      promptChars: preset.promptMaxChars,
    }

    const atLimit = await POST(request(base))
    const overLimit = await POST(request({ ...base, promptChars: preset.promptMaxChars * 1000 }))

    const atBody = (await atLimit.json()) as { usd: number }
    const overBody = (await overLimit.json()) as { usd: number }

    expect(overLimit.status).toBe(200)
    expect(overBody.usd).toBeCloseTo(atBody.usd)
  })
})
