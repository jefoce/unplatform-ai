/* eslint-disable max-lines, max-lines-per-function -- mapper cases share one fixture table */

import { isNil } from 'lodash-es'
import { describe, expect, it } from 'vitest'

import imageFixture from '../docs/protocol/upai-1/fixtures/models-image.json'
import invalidFixture from '../docs/protocol/upai-1/fixtures/models-invalid.json'
import videoFixture from '../docs/protocol/upai-1/fixtures/models-video.json'
import { CUSTOM_DURATION_OPTIONS_MAX } from '../src/core/constants'
import { resolutionDisplay } from '../src/core/presets/common/display'
import { mapCustomModel } from '../src/core/presets/custom/from-capabilities'
import { CUSTOM_INVALID_REASON, CUSTOM_STALE_REASON } from '../src/core/presets/custom/shared'
import type { MappedCustomModel } from '../src/core/presets/custom/types'
import type { ImagePreset } from '../src/core/presets/image/types'
import type { VideoPreset } from '../src/core/presets/video/types'
import { renderPromptForApi } from '../src/core/prompt-tokens'
import {
  type UpaiModel,
  UpaiModelListSchema,
  type UpaiReferenceLabels,
} from '../src/core/protocol/upai'
import { CustomEndpointSchema } from '../src/core/schemas/custom-endpoint'
import { ImageInputSchema } from '../src/core/schemas/image-record'
import { validateImageInput } from '../src/core/validation/image'
import minimaxFixture from './fixtures/custom/minimax-h3-models.json'

const ENDPOINT = CustomEndpointSchema.parse({
  id: 'endpoint-1',
  label: 'Studio PC',
  badge: 'CU1',
  baseUrl: 'http://127.0.0.1:8188',
})

const VIDEO_MODELS = UpaiModelListSchema.parse(videoFixture).data
const IMAGE_MODELS = UpaiModelListSchema.parse(imageFixture).data
const INVALID_MODELS = UpaiModelListSchema.parse(invalidFixture).data
const MINIMAX_MODELS = UpaiModelListSchema.parse(minimaxFixture).data

function modelAt(models: readonly UpaiModel[], index: number): UpaiModel {
  const model = models[index]

  if (isNil(model)) {
    throw new Error(`Missing fixture model ${index}`)
  }

  return model
}

function mapModel(model: UpaiModel, maxUploadBytes?: number): MappedCustomModel {
  return mapCustomModel({ endpoint: ENDPOINT, model, maxUploadBytes })
}

function expectVideo(result: MappedCustomModel): VideoPreset {
  const { preset } = result

  if (isNil(preset) || !('duration' in preset)) {
    throw new Error('Expected a video preset')
  }

  return preset
}

function expectImage(result: MappedCustomModel): ImagePreset {
  const { preset } = result

  if (isNil(preset) || !('qualities' in preset)) {
    throw new Error('Expected an image preset')
  }

  return preset
}

describe('video mapping', () => {
  it('maps the fixture model onto a custom video preset', () => {
    const model = modelAt(VIDEO_MODELS, 0)
    const result = mapModel(model, 10 * 1024 * 1024)
    const preset = expectVideo(result)

    expect(preset).toMatchObject({
      id: `custom.endpoint-1.${model.id}`,
      title: model.name,
      family: 'custom',
      promptOptional: false,
      promptMaxChars: 4000,
      duration: { min: 2, max: 5, default: 5 },
      resolutions: ['480p', '720p'],
      defaultResolution: '480p',
      aspectRatios: ['16:9', '9:16', '1:1'],
      defaultAspectRatio: '16:9',
      seed: true,
      audio: { supported: false, default: false },
      maxInputPlusOutputSec: null,
      autoAspectWithFrames: false,
    })

    expect(result.availability).toEqual({ status: 'available', reason: null })
    expect(result.warnings).toEqual([])
  })

  it('keeps references, frames, limits and sizes', () => {
    const model = modelAt(VIDEO_MODELS, 0)
    const preset = expectVideo(mapModel(model, 10 * 1024 * 1024))

    expect(preset.references).toEqual({
      image: 2,
      video: 0,
      audio: 0,
      videoTotalSec: 30,
      audioTotalSec: 30,
    })

    expect(preset.referencesRequired).toEqual({ image: 0, video: 0, audio: 0 })

    expect(preset.frames).toEqual({
      start: true,
      end: false,
      startRequired: true,
      endRequired: false,
    })

    expect(preset.referenceLimits?.image?.maxBytes).toBe(20 * 1024 * 1024)
    expect(preset.referenceLimits?.video?.maxBytes).toBe(10 * 1024 * 1024)
    expect(preset.referenceLimits?.audio?.maxBytes).toBe(10 * 1024 * 1024)
    expect(preset.outputSizes?.['480p']?.['16:9']).toBe('832x480')
  })

  it('uses the agreed perRun binding without sku rules', () => {
    const model = modelAt(VIDEO_MODELS, 0)
    const preset = expectVideo(mapModel(model))

    expect(preset.bindings[0]).toMatchObject({
      provider: 'custom',
      modelId: model.id,
      pricing: { formula: 'perRun', skuRules: [], fallback: { per_run: 0 } },
      transport: { image: 'base64', video: 'upload', audio: 'upload' },
    })
  })

  it('rounds durations to integers and turns a step into a grid and quick picks', () => {
    const base = modelAt(VIDEO_MODELS, 1)

    const model: UpaiModel = {
      ...base,
      capabilities: {
        ...base.capabilities,
        duration: { min: 2.4, max: 9.9, default: 20, step: 3 },
      },
    }

    const preset = expectVideo(mapModel(model))

    expect(preset.duration).toEqual({ min: 3, max: 9, default: 9, step: 3, options: [3, 6, 9] })
    expect(preset.duration.options?.length).toBeLessThanOrEqual(CUSTOM_DURATION_OPTIONS_MAX)
  })

  it('aligns max and default to the step grid anchored at min', () => {
    const base = modelAt(VIDEO_MODELS, 1)

    const model: UpaiModel = {
      ...base,
      capabilities: {
        ...base.capabilities,
        duration: { min: 3, max: 9, default: 9, step: 4 },
      },
    }

    const preset = expectVideo(mapModel(model))

    expect(preset.duration).toEqual({ min: 3, max: 7, default: 7, step: 4, options: [3, 7] })
    expect(preset.duration.options?.length).toBeLessThanOrEqual(CUSTOM_DURATION_OPTIONS_MAX)
  })

  it('caps a long duration at the advertised maximum', () => {
    const base = modelAt(VIDEO_MODELS, 1)

    const model: UpaiModel = {
      ...base,
      capabilities: {
        ...base.capabilities,
        duration: { min: 1, max: 1000, default: 1000, step: 1 },
      },
    }

    const result = mapModel(model)
    const preset = expectVideo(result)

    expect(preset.duration).toEqual({ min: 1, max: 120, default: 120 })
    expect(result.warnings).toContain('Duration capped at 120 s')
  })

  it('caps a long stepped duration on its grid', () => {
    const base = modelAt(VIDEO_MODELS, 1)

    const model: UpaiModel = {
      ...base,
      capabilities: {
        ...base.capabilities,
        duration: { min: 3, max: 1000, default: 500, step: 5 },
      },
    }

    const result = mapModel(model)
    const preset = expectVideo(result)

    expect(preset.duration).toMatchObject({ min: 3, max: 118, default: 118, step: 5 })
    expect(preset.duration.options).toHaveLength(24)
    expect(preset.duration.options?.at(-1)).toBe(118)
    expect(result.warnings).toContain('Duration capped at 120 s')
  })

  it('drops a duration entirely above the cap', () => {
    const base = modelAt(VIDEO_MODELS, 1)

    const model: UpaiModel = {
      ...base,
      capabilities: {
        ...base.capabilities,
        duration: { min: 200, max: 400, default: 300, step: 1 },
      },
    }

    const result = mapModel(model)

    expect(result.preset).toBeNull()
    expect(result.warnings).toContain('Duration is above the 120 s cap')
  })

  it('keeps an unknown resolution name and its default in endpoint order', () => {
    const base = modelAt(VIDEO_MODELS, 1)

    const model: UpaiModel = {
      ...base,
      capabilities: {
        ...base.capabilities,
        resolutions: ['480p', '900p'],
        default_resolution: '900p',
      },
    }

    const result = mapModel(model)
    const preset = expectVideo(result)

    expect(preset.resolutions).toEqual(['480p', '900p'])
    expect(preset.defaultResolution).toBe('900p')
    expect(result.warnings).toEqual([])
  })

  it('keeps an unknown aspect name without a warning', () => {
    const base = modelAt(VIDEO_MODELS, 1)

    const model: UpaiModel = {
      ...base,
      capabilities: {
        ...base.capabilities,
        aspect_ratios: ['16:9', '5:4'],
        default_aspect_ratio: '5:4',
      },
    }

    const result = mapModel(model)
    const preset = expectVideo(result)

    expect(preset.aspectRatios).toEqual(['16:9', '5:4'])
    expect(preset.defaultAspectRatio).toBe('5:4')
    expect(result.warnings).toEqual([])
  })

  it('drops the model when its default resolution is not listed', () => {
    const base = modelAt(VIDEO_MODELS, 1)

    const model: UpaiModel = {
      ...base,
      capabilities: {
        ...base.capabilities,
        resolutions: ['480p', '720p'],
        default_resolution: '900p',
      },
    }

    const result = mapModel(model)

    expect(result.preset).toBeNull()

    expect(result.warnings).toContain('Dropped model: default resolution 900p is not listed')
  })

  it('drops the model when its default aspect ratio is not listed', () => {
    const base = modelAt(VIDEO_MODELS, 1)

    const model: UpaiModel = {
      ...base,
      capabilities: {
        ...base.capabilities,
        aspect_ratios: ['16:9'],
        default_aspect_ratio: '9:16',
      },
    }

    const result = mapModel(model)

    expect(result.preset).toBeNull()
    expect(result.warnings).toContain('Dropped model: default aspect 9:16 is not listed')
  })

  it('drops the model when its resolution list is empty', () => {
    const base = modelAt(VIDEO_MODELS, 1)

    const model: UpaiModel = {
      ...base,
      capabilities: { ...base.capabilities, resolutions: [] },
    }

    expect(mapModel(model).preset).toBeNull()
  })

  it('carries required reference counts', () => {
    const base = modelAt(VIDEO_MODELS, 0)

    const model: UpaiModel = {
      ...base,
      capabilities: {
        ...base.capabilities,
        references: {
          ...base.capabilities.references,
          image: { max: 2, required: 1 },
        },
      },
    }

    const preset = expectVideo(mapModel(model))

    expect(preset.referencesRequired).toEqual({ image: 1, video: 0, audio: 0 })
  })

  it('carries the workflow name and description', () => {
    const base = modelAt(VIDEO_MODELS, 0)

    const model: UpaiModel = {
      ...base,
      description: 'Local video workflow',
      workflow: { id: 'wan22', name: 'Wan 2.2' },
    }

    const preset = expectVideo(mapModel(model))

    expect(preset.workflowName).toBe('Wan 2.2')
    expect(preset.description).toBe('Local video workflow')
  })

  it('marks a stale model available with the workflow hint', () => {
    const base = modelAt(VIDEO_MODELS, 0)
    const result = mapModel({ ...base, status: 'stale', status_reason: 'workflow is newer' })

    expect(result.availability).toEqual({ status: 'available', reason: CUSTOM_STALE_REASON })
  })
})

describe('minimax scale preset', () => {
  it('maps both ready models with every scale resolution', () => {
    for (const model of MINIMAX_MODELS) {
      const result = mapModel(model)
      const preset = expectVideo(result)

      expect(preset.id).toBe(`custom.endpoint-1.${model.id}`)
      expect(preset.family).toBe('custom')
      expect(preset.resolutions).toHaveLength(14)
      expect(preset.aspectRatios).toEqual(['16:9', '21:9', '4:3', '1:1', '3:4', '9:16'])
      expect(preset.defaultResolution).toBe('0.9')
      expect(preset.defaultAspectRatio).toBe('16:9')
      expect(preset.duration).toEqual({ min: 4, max: 15, default: 5 })
      expect(result.warnings).toEqual([])
    }
  })

  it('labels 0.9 at 16:9 and 9:16 from the size table', () => {
    const preset = expectVideo(mapModel(modelAt(MINIMAX_MODELS, 0)))

    expect(resolutionDisplay(preset, { resolution: '0.9', aspect: '16:9' })).toEqual({
      label: '1280×736',
      detail: '0.9',
    })

    expect(resolutionDisplay(preset, { resolution: '0.9', aspect: '9:16' })).toEqual({
      label: '736×1280',
      detail: '0.9',
    })
  })

  it('keeps a model with an unknown resolution and drops only a missing default', () => {
    const base = modelAt(MINIMAX_MODELS, 0)

    const unknown: UpaiModel = {
      ...base,
      capabilities: {
        ...base.capabilities,
        resolutions: [...base.capabilities.resolutions, '3.0'],
        default_resolution: '3.0',
      },
    }

    const kept = mapModel(unknown)

    expect(kept.preset).not.toBeNull()
    expect(expectVideo(kept).resolutions).toContain('3.0')

    const missing: UpaiModel = {
      ...base,
      capabilities: { ...base.capabilities, default_resolution: '3.0' },
    }

    const dropped = mapModel(missing)

    expect(dropped.preset).toBeNull()
    expect(dropped.warnings).toContain('Dropped model: default resolution 3.0 is not listed')
  })
})

describe('image mapping', () => {
  it('maps the fixture model onto a custom image preset', () => {
    const model = modelAt(IMAGE_MODELS, 0)
    const result = mapModel(model)
    const preset = expectImage(result)

    expect(preset).toMatchObject({
      id: `custom.endpoint-1.${model.id}`,
      title: model.name,
      description: model.description,
      family: 'custom',
      defaultResolution: '1K',
      defaultAspectRatio: '1:1',
      qualities: null,
      defaultQuality: null,
      backgrounds: null,
      defaultBackground: null,
      maxN: 4,
      referenceMax: 1,
      seed: true,
      params: ['n', 'aspect_ratio', 'resolution', 'seed', 'input_references'],
    })

    expect(preset.resolutions).toHaveLength(6)
    expect(preset.aspectRatios).toHaveLength(23)
    expect(preset.bindings[0]).toMatchObject({ provider: 'custom', modelId: model.id })
    expect(result.warnings).toEqual([])
  })

  it('carries the workflow name and description', () => {
    const base = modelAt(IMAGE_MODELS, 0)

    const model: UpaiModel = {
      ...base,
      description: 'Local image workflow',
      workflow: { id: 'sdxl', name: 'SDXL' },
    }

    const preset = expectImage(mapModel(model))

    expect(preset.workflowName).toBe('SDXL')
    expect(preset.description).toBe('Local image workflow')
  })

  it('filters params by the declared capabilities', () => {
    const base = modelAt(IMAGE_MODELS, 0)

    const model: UpaiModel = {
      ...base,
      capabilities: {
        ...base.capabilities,
        resolutions: [],
        aspect_ratios: [],
        seed: false,
        count: { max: 0 },
        references: {
          image: { max: 0, required: 0 },
          video: { max: 0, required: 0 },
          audio: { max: 0, required: 0 },
        },
      },
    }

    const preset = expectImage(mapModel(model))

    expect(preset.params).toEqual([])
    expect(preset.resolutions).toBeNull()
    expect(preset.defaultResolution).toBeNull()
    expect(preset.aspectRatios).toEqual(['auto'])
    expect(preset.defaultAspectRatio).toBe('auto')
    expect(preset.maxN).toBe(1)
    expect(preset.referenceMax).toBe(0)
  })

  it('validates an empty aspect list as auto', () => {
    const base = modelAt(IMAGE_MODELS, 0)

    const model: UpaiModel = {
      ...base,
      capabilities: { ...base.capabilities, aspect_ratios: [] },
    }

    const preset = expectImage(mapModel(model))

    const input = ImageInputSchema.parse({
      presetId: preset.id,
      prompt: 'a cat',
      count: 1,
      aspectRatio: 'auto',
      resolution: preset.defaultResolution,
      quality: null,
      background: null,
      references: [],
      seed: null,
    })

    expect(validateImageInput(preset, input)).toEqual([])
  })

  it('maps an invalid model to a disabled preset with its status reason', () => {
    const model = modelAt(INVALID_MODELS, 0)
    const result = mapModel(model)
    const preset = expectImage(result)

    expect(preset.id).toBe(`custom.endpoint-1.${model.id}`)

    expect(result.availability).toEqual({
      status: 'invalid',
      reason: 'node class KSampler is not installed',
    })
  })

  it('falls back to the generic reason when an invalid model has none', () => {
    const model = modelAt(INVALID_MODELS, 0)
    const result = mapModel({ ...model, status_reason: null })

    expect(result.availability).toEqual({ status: 'invalid', reason: CUSTOM_INVALID_REASON })
  })
})

function withReferenceLabel(
  base: UpaiModel,
  referenceLabel: string | null | undefined,
  referenceLabels?: UpaiReferenceLabels | null,
): UpaiModel {
  return {
    ...base,
    capabilities: {
      ...base.capabilities,
      prompt: {
        ...base.capabilities.prompt,
        reference_label: referenceLabel,
        reference_labels: referenceLabels,
      },
    },
  }
}

describe('reference label templates', () => {
  it('keeps the defaults when the template is absent or null', () => {
    const video = expectVideo(mapModel(withReferenceLabel(modelAt(VIDEO_MODELS, 0), undefined)))
    const image = expectImage(mapModel(withReferenceLabel(modelAt(IMAGE_MODELS, 0), null)))

    expect(video.refLabel).toBe('{Kind} {n}')
    expect(image.refLabel).toBe('image {n}')
  })

  it('keeps a valid template for video and image', () => {
    const video = expectVideo(
      mapModel(withReferenceLabel(modelAt(VIDEO_MODELS, 0), '<{kind}_{n}>')),
    )

    const image = expectImage(mapModel(withReferenceLabel(modelAt(IMAGE_MODELS, 0), '{Kind} #{i}')))

    expect(video.refLabel).toBe('<{kind}_{n}>')
    expect(image.refLabel).toBe('{Kind} #{i}')
  })

  it('falls back with a warning for an invalid template', () => {
    const video = mapModel(withReferenceLabel(modelAt(VIDEO_MODELS, 0), '<{kind}_{m}>'))
    const image = mapModel(withReferenceLabel(modelAt(IMAGE_MODELS, 0), 'image x'))

    expect(expectVideo(video).refLabel).toBe('{Kind} {n}')
    expect(expectImage(image).refLabel).toBe('image {n}')

    expect(video.warnings).toContain('Ignored reference label template <{kind}_{m}>')
    expect(image.warnings).toContain('Ignored reference label template image x')
  })

  it('falls back for a template longer than 64 characters', () => {
    const raw = `{Kind} ${'x'.repeat(60)}`
    const result = mapModel(withReferenceLabel(modelAt(VIDEO_MODELS, 0), raw))

    expect(expectVideo(result).refLabel).toBe('{Kind} {n}')
    expect(result.warnings).toContain(`Ignored reference label template ${raw}`)
  })

  it('resolves a label for every kind from the shared template', () => {
    const video = expectVideo(
      mapModel(withReferenceLabel(modelAt(VIDEO_MODELS, 0), '<{kind}_{n}>')),
    )

    expect(video.refLabels).toEqual({
      image: '<{kind}_{n}>',
      video: '<{kind}_{n}>',
      audio: '<{kind}_{n}>',
    })
  })

  it('uses a per-kind label and fills the rest from the shared template', () => {
    const video = expectVideo(
      mapModel(
        withReferenceLabel(modelAt(VIDEO_MODELS, 0), '<{kind}_{n}>', {
          image: '<Picture {n}>',
        }),
      ),
    )

    expect(video.refLabels).toEqual({
      image: '<Picture {n}>',
      video: '<{kind}_{n}>',
      audio: '<{kind}_{n}>',
    })
  })

  it('uses the app defaults for every kind when both are absent', () => {
    const video = expectVideo(mapModel(withReferenceLabel(modelAt(VIDEO_MODELS, 0), undefined)))
    const image = expectImage(mapModel(withReferenceLabel(modelAt(IMAGE_MODELS, 0), null)))

    expect(video.refLabels).toEqual({
      image: '{Kind} {n}',
      video: '{Kind} {n}',
      audio: '{Kind} {n}',
    })

    expect(image.refLabels).toEqual({
      image: 'image {n}',
      video: 'image {n}',
      audio: 'image {n}',
    })
  })

  it('ignores an invalid per-kind template with a kind warning', () => {
    const result = mapModel(
      withReferenceLabel(modelAt(VIDEO_MODELS, 0), '<{kind}_{n}>', {
        image: '<Picture>',
        audio: '<{kind}_{m}>',
      }),
    )

    expect(expectVideo(result).refLabels).toEqual({
      image: '<{kind}_{n}>',
      video: '<{kind}_{n}>',
      audio: '<{kind}_{n}>',
    })

    expect(result.warnings).toContain('Ignored reference label template for image <Picture>')
    expect(result.warnings).toContain('Ignored reference label template for audio <{kind}_{m}>')
  })

  it('maps and renders the minimax per-kind labels', () => {
    const preset = expectVideo(mapModel(modelAt(MINIMAX_MODELS, 0)))

    expect(preset.refLabels).toEqual({
      image: '<Picture {n}>',
      video: '<Video {n}>',
      audio: '<Audio {n}>',
    })

    expect(renderPromptForApi('@Image 1, @Video 1 and @Audio 1', preset)).toBe(
      '<Picture 1>, <Video 1> and <Audio 1>',
    )
  })

  it('merges size overrides over the base sizes', () => {
    const base = modelAt(VIDEO_MODELS, 0)

    const model: UpaiModel = {
      ...base,
      capabilities: {
        ...base.capabilities,
        size_overrides: { '480p': { '16:9': '640x360' } },
      },
    }

    const preset = expectVideo(mapModel(model))

    expect(preset.outputSizes?.['480p']?.['16:9']).toBe('640x360')
  })
})
