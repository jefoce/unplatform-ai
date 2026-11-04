import { describe, expect, it } from 'vitest'

import { buildRequestBody } from '@/server/providers/openrouter/body'
import { buildImageBody } from '@/server/providers/openrouter/images'
import type { ResolvedMedia } from '@/server/providers/types'

import { IMAGE_REFERENCE_MAX_MB } from '../src/core/constants'
import { VIDEO_PRESETS } from '../src/core/presets'
import { IMAGE_PRESETS } from '../src/core/presets/image'
import type { ImagePreset } from '../src/core/presets/image/types'
import type { VideoPreset } from '../src/core/presets/video/types'
import type { GenerationInput } from '../src/core/schemas/generation-record'
import type { ImageGenerationInput } from '../src/core/schemas/image-record'
import type { Dict } from '../src/core/utility-types'
import { validateImageInput } from '../src/core/validation/image'
import { validateInput } from '../src/core/validation/video'
import { upload, uploadsOf } from './helpers/validation-fixtures'

const IMAGE_REFERENCES = [
  { id: 'ref-1', dataUrl: 'data:image/png;base64,AAAA' },
  { id: 'ref-2', dataUrl: 'data:image/webp;base64,BBBB' },
]

const VIDEO_MEDIA: Dict<ResolvedMedia> = {
  img: { id: 'img', kind: 'image', url: 'data:image/png;base64,IMG' },
  vid: { id: 'vid', kind: 'video', url: 'data:video/mp4;base64,VID' },
  aud: { id: 'aud', kind: 'audio', url: 'data:audio/mpeg;base64,AUD' },
  start: { id: 'start', kind: 'image', url: 'data:image/png;base64,START' },
  end: { id: 'end', kind: 'image', url: 'data:image/png;base64,END' },
}

const RENDERED_VIDEO_PROMPTS: Dict<string> = {
  'wan-3.0': 'Image 1 with Video 1 and Audio 1',
  'wan-3.0-prime': 'Image 1 with Video 1 and Audio 1',
  'seedance-2.0': 'Image 1 with Video 1 and Audio 1',
  'seedance-2.5': '@Image 1 with @Video 1 and @Audio 1',
}

function imageInput(preset: ImagePreset): ImageGenerationInput {
  return {
    presetId: preset.id,
    prompt: 'A @Image 1 next to @Image 2',
    count: 1,
    aspectRatio: preset.defaultAspectRatio,
    resolution: preset.defaultResolution,
    quality: preset.defaultQuality,
    background: preset.defaultBackground,
    references: IMAGE_REFERENCES.map((reference) => {
      return reference.id
    }),
    seed: preset.seed ? 1 : null,
  }
}

function videoInput(
  preset: VideoPreset,
  overrides: Partial<GenerationInput> = {},
): GenerationInput {
  return {
    presetId: preset.id,
    tab: 'references',
    prompt: '@Image 1 with @Video 1 and @Audio 1',
    audio: true,
    duration: preset.duration.default,
    aspectRatio: preset.defaultAspectRatio,
    resolution: preset.defaultResolution,
    frames: { start: null, end: null },
    references: ['img', 'vid', 'aud'],
    seed: null,
    ...overrides,
  }
}

describe('image prompt contract', () => {
  it('sends two image references in draft order for every image preset', () => {
    for (const preset of IMAGE_PRESETS) {
      const body = buildImageBody({
        preset,
        input: imageInput(preset),
        references: IMAGE_REFERENCES,
      })

      expect(body.input_references, preset.id).toHaveLength(2)

      expect(
        body.input_references?.map((part) => {
          return part.image_url.url
        }),
        preset.id,
      ).toEqual(['data:image/png;base64,AAAA', 'data:image/webp;base64,BBBB'])

      for (const reference of IMAGE_REFERENCES) {
        expect(reference.dataUrl.startsWith('data:image/'), preset.id).toBe(true)
        expect(reference.dataUrl.includes(';base64,'), preset.id).toBe(true)

        expect(reference.dataUrl.length, preset.id).toBeLessThan(
          IMAGE_REFERENCE_MAX_MB * 1024 * 1024,
        )
      }
    }
  })

  it('renders @Image mentions without the at sign for every image preset', () => {
    for (const preset of IMAGE_PRESETS) {
      const body = buildImageBody({
        preset,
        input: imageInput(preset),
        references: IMAGE_REFERENCES,
      })

      expect(body.prompt, preset.id).toBe('A image 1 next to image 2')
    }
  })

  it('declares input_references on every image preset that takes references', () => {
    for (const preset of IMAGE_PRESETS) {
      if (preset.referenceMax === 0) {
        continue
      }

      expect(preset.params, preset.id).toContain('input_references')
    }
  })
})

describe('video prompt contract', () => {
  it('sends image, video and audio references in draft order for every video preset', () => {
    for (const preset of VIDEO_PRESETS) {
      const body = buildRequestBody({
        input: videoInput(preset),
        preset,
        media: VIDEO_MEDIA,
      })

      expect(body.input_references, preset.id).toEqual([
        { type: 'image_url', image_url: { url: 'data:image/png;base64,IMG' } },
        { type: 'video_url', video_url: { url: 'data:video/mp4;base64,VID' } },
        { type: 'audio_url', audio_url: { url: 'data:audio/mpeg;base64,AUD' } },
      ])

      expect(body.frame_images, preset.id).toBeUndefined()
    }
  })

  it('sends start and end frames first and last for every video preset', () => {
    for (const preset of VIDEO_PRESETS) {
      const body = buildRequestBody({
        input: videoInput(preset, {
          tab: 'frames',
          prompt: '',
          frames: { start: 'start', end: 'end' },
          references: [],
        }),
        preset,
        media: VIDEO_MEDIA,
      })

      expect(body.frame_images, preset.id).toEqual([
        {
          type: 'image_url',
          image_url: { url: 'data:image/png;base64,START' },
          frame_type: 'first_frame',
        },
        {
          type: 'image_url',
          image_url: { url: 'data:image/png;base64,END' },
          frame_type: 'last_frame',
        },
      ])

      expect(body.input_references, preset.id).toBeUndefined()
    }
  })

  it('renders the prompt labels for every video preset', () => {
    for (const preset of VIDEO_PRESETS) {
      const body = buildRequestBody({
        input: videoInput(preset),
        preset,
        media: VIDEO_MEDIA,
      })

      expect(body.prompt, preset.id).toBe(RENDERED_VIDEO_PROMPTS[preset.id])
    }
  })
})

describe('out-of-range mentions', () => {
  it('reports an image mention past the attached references before submit', () => {
    const preset = IMAGE_PRESETS[0]
    const input = { ...imageInput(preset), prompt: '@Image 3' }

    expect(validateImageInput(preset, input)).toContainEqual({
      type: 'missing-slot',
      slot: { kind: 'image', n: 3 },
      attached: 2,
    })
  })

  it('reports a video mention past the attached references before submit', () => {
    const preset = VIDEO_PRESETS[0]

    const result = validateInput({
      input: videoInput(preset, { prompt: '@Image 3', references: ['img-1', 'img-2'] }),
      uploads: uploadsOf(upload('img-1', 'image'), upload('img-2', 'image')),
      preset,
    })

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('@Image 3 is not attached (2 images)')
  })
})
