/* eslint-disable max-lines, max-lines-per-function -- mapper cases share one fixture table */

import { isNil } from 'lodash-es'
import { describe, expect, it } from 'vitest'

import imageFixture from '../docs/protocol/upai-1/fixtures/models-image.json'
import invalidFixture from '../docs/protocol/upai-1/fixtures/models-invalid.json'
import videoFixture from '../docs/protocol/upai-1/fixtures/models-video.json'
import { mapCustomModel } from '../src/core/presets/custom/from-capabilities'
import { CUSTOM_INVALID_REASON, CUSTOM_STALE_REASON } from '../src/core/presets/custom/shared'
import type { MappedCustomModel } from '../src/core/presets/custom/types'
import type { ImagePreset } from '../src/core/presets/image/types'
import type { VideoPreset } from '../src/core/presets/video/types'
import { type UpaiModel, UpaiModelListSchema } from '../src/core/protocol/upai'
import { CustomEndpointSchema } from '../src/core/schemas/custom-endpoint'
import { ImageInputSchema } from '../src/core/schemas/image-record'
import { validateImageInput } from '../src/core/validation/image'

const ENDPOINT = CustomEndpointSchema.parse({
  id: 'endpoint-1',
  label: 'Studio PC',
  badge: 'CU1',
  baseUrl: 'http://127.0.0.1:8188',
})

const VIDEO_MODELS = UpaiModelListSchema.parse(videoFixture).data
const IMAGE_MODELS = UpaiModelListSchema.parse(imageFixture).data
const INVALID_MODELS = UpaiModelListSchema.parse(invalidFixture).data

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
  })

  it('drops unsupported resolutions and falls back to a kept default', () => {
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

    expect(preset.resolutions).toEqual(['480p'])
    expect(preset.defaultResolution).toBe('480p')

    expect(
      result.warnings.some((warning) => {
        return warning.includes('900p')
      }),
    ).toBe(true)
  })

  it('drops the model when no resolution is supported', () => {
    const base = modelAt(VIDEO_MODELS, 1)

    const model: UpaiModel = {
      ...base,
      capabilities: {
        ...base.capabilities,
        resolutions: ['900p'],
        default_resolution: '900p',
      },
    }

    const result = mapModel(model)

    expect(result.preset).toBeNull()

    expect(
      result.warnings.some((warning) => {
        return warning.includes('900p')
      }),
    ).toBe(true)
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
