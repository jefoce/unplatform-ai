import { describe, expect, it } from 'vitest'

import { getPreset } from '@/core/presets'
import type { GenerationInput } from '@/core/schemas/generation-record'
import type { Dict } from '@/core/utility-types'
import { buildRequestBody } from '@/server/providers/openrouter/body'
import type { ResolvedMedia } from '@/server/providers/types'

const preset = getPreset('wan-3.0')

const media: Dict<ResolvedMedia> = {
  start: { id: 'start', kind: 'image', url: 'data:image/png;base64,START' },
  end: { id: 'end', kind: 'image', url: 'data:image/png;base64,END' },
  img: { id: 'img', kind: 'image', url: 'data:image/png;base64,IMG' },
  vid: { id: 'vid', kind: 'video', url: 'data:video/mp4;base64,VID' },
  aud: { id: 'aud', kind: 'audio', url: 'data:audio/mpeg;base64,AUD' },
}

function input(overrides: Partial<GenerationInput> = {}): GenerationInput {
  return {
    presetId: preset.id,
    tab: 'references',
    prompt: 'A cat',
    audio: true,
    duration: 5,
    aspectRatio: '16:9',
    resolution: '1080p',
    frames: { start: null, end: null },
    references: [],
    seed: null,
    ...overrides,
  }
}

describe('buildRequestBody text', () => {
  it('builds a text-only body', () => {
    const body = buildRequestBody({ input: input({ seed: 42 }), preset, media })

    expect(body).toEqual({
      model: 'alibaba/wan-3.0',
      duration: 5,
      resolution: '1080p',
      generate_audio: true,
      prompt: 'A cat',
      seed: 42,
      aspect_ratio: '16:9',
    })
  })

  it('omits seed when input.seed is null', () => {
    const body = buildRequestBody({ input: input({ seed: null }), preset, media })

    expect(body.seed).toBeUndefined()
  })
})

describe('buildRequestBody frames', () => {
  it('sends only a first frame when there is no end frame', () => {
    const body = buildRequestBody({
      input: input({
        tab: 'frames',
        prompt: '',
        aspectRatio: 'auto',
        frames: { start: 'start', end: null },
      }),
      preset,
      media,
    })

    expect(body.frame_images).toEqual([
      {
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,START' },
        frame_type: 'first_frame',
      },
    ])

    expect(body.input_references).toBeUndefined()
    expect(body.aspect_ratio).toBeUndefined()
  })

  it('sends first then last frame', () => {
    const body = buildRequestBody({
      input: input({ tab: 'frames', prompt: '', frames: { start: 'start', end: 'end' } }),
      preset,
      media,
    })

    expect(
      body.frame_images?.map((frame) => {
        return frame.frame_type
      }),
    ).toEqual(['first_frame', 'last_frame'])

    expect(body.frame_images?.[1]?.image_url.url).toBe('data:image/png;base64,END')
  })
})

describe('buildRequestBody references and slots', () => {
  it('keeps reference order and the kind-specific media key', () => {
    const body = buildRequestBody({
      input: input({ references: ['vid', 'img', 'aud'] }),
      preset,
      media,
    })

    expect(body.input_references).toEqual([
      { type: 'video_url', video_url: { url: 'data:video/mp4;base64,VID' } },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,IMG' } },
      { type: 'audio_url', audio_url: { url: 'data:audio/mpeg;base64,AUD' } },
    ])

    expect(body.frame_images).toBeUndefined()
  })

  it('renders prompt slots for the API', () => {
    const body = buildRequestBody({
      input: input({ prompt: '@Image 1 walks', references: ['img'] }),
      preset,
      media,
    })

    expect(body.prompt).toBe('Image 1 walks')
  })

  it('renders Seedance 2.5 slots with the at prefix', () => {
    const seedance = getPreset('seedance-2.5')

    const body = buildRequestBody({
      input: input({
        presetId: seedance.id,
        resolution: '720p',
        prompt: '@Image 1 walks',
        references: ['img'],
      }),
      preset: seedance,
      media,
    })

    expect(body.prompt).toBe('@Image 1 walks')
  })
})

describe('buildRequestBody limits', () => {
  it('never sends frames and references together', () => {
    const body = buildRequestBody({
      input: input({
        tab: 'frames',
        prompt: '',
        frames: { start: 'start', end: null },
        references: ['img'],
      }),
      preset,
      media,
    })

    expect(body.frame_images).toHaveLength(1)
    expect(body.input_references).toBeUndefined()
  })

  it('omits generate_audio when the preset does not support it', () => {
    const silent = { ...preset, audio: { supported: false, default: false } }

    const body = buildRequestBody({
      input: input({ audio: true }),
      preset: silent,
      media,
    })

    expect(body.generate_audio).toBeUndefined()
  })

  it('omits seed when the preset has no seed control', () => {
    const noSeed = { ...preset, seed: false }
    const body = buildRequestBody({ input: input({ seed: 42 }), preset: noSeed, media })

    expect(body.seed).toBeUndefined()
  })

  it('omits the last frame when the preset lacks it', () => {
    const noEnd = { ...preset, frames: { start: true, end: false } }

    const body = buildRequestBody({
      input: input({ tab: 'frames', prompt: '', frames: { start: 'start', end: 'end' } }),
      preset: noEnd,
      media,
    })

    expect(
      body.frame_images?.map((frame) => {
        return frame.frame_type
      }),
    ).toEqual(['first_frame'])
  })

  it('omits the first frame when the preset lacks it', () => {
    const noStart = { ...preset, frames: { start: false, end: false } }

    const body = buildRequestBody({
      input: input({ tab: 'frames', prompt: '', frames: { start: 'start', end: null } }),
      preset: noStart,
      media,
    })

    expect(body.frame_images).toBeUndefined()
  })
})

describe('buildRequestBody prime', () => {
  it('builds a text-only Prime body', () => {
    const body = buildRequestBody({
      input: input({ presetId: 'wan-3.0-prime' }),
      preset: getPreset('wan-3.0-prime'),
      media,
    })

    expect(body.model).toBe('alibaba/wan-3.0-prime')
    expect(body.prompt).toBe('A cat')
    expect(body.input_references).toBeUndefined()
    expect(body.frame_images).toBeUndefined()
  })
})

describe('buildRequestBody missing media', () => {
  it('throws when a frame id is absent from media', () => {
    expect(() => {
      return buildRequestBody({
        input: input({ tab: 'frames', prompt: '', frames: { start: 'absent', end: null } }),
        preset,
        media,
      })
    }).toThrow('Missing media for input absent')
  })

  it('throws when a reference id is absent from media', () => {
    expect(() => {
      return buildRequestBody({ input: input({ references: ['absent'] }), preset, media })
    }).toThrow('Missing media for input absent')
  })
})
