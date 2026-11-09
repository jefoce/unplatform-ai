import 'server-only'

import { isNil } from 'lodash-es'

import { isOneOf } from '@/core/guards'
import type { UpaiCapabilities, UpaiModel } from '@/core/protocol/upai'

import type { EndpointSignal, ProviderImageModel, ProviderModel } from '../types'
import { customMockFixtures } from './custom-fixtures'

const CUSTOM_MOCK_SCENARIOS = ['ready', 'stale', 'invalid', 'unreachable'] as const

export type CustomMockScenario = (typeof CUSTOM_MOCK_SCENARIOS)[number]

export const CUSTOM_MOCK_STALE_REASON = 'Workflow changed in ComfyUI since the last save'

const MOCK_INSTANCE_PREFIX = 'mock-'

const SCALE_RESOLUTIONS = [
  '0.2',
  '0.3',
  '0.4',
  '0.5',
  '0.6',
  '0.7',
  '0.8',
  '0.9',
  '0.98',
  '1.0',
  '1.2',
  '1.5',
  '1.8',
  '2.0',
] as const

const SCALE_ASPECTS = ['16:9', '21:9', '4:3', '1:1', '3:4', '9:16'] as const

const SCALE_SIZES = {
  '0.2': {
    '16:9': '608x352',
    '21:9': '704x288',
    '4:3': '544x384',
    '1:1': '448x448',
    '3:4': '384x544',
    '9:16': '352x608',
  },
  '0.9': {
    '16:9': '1280x736',
    '21:9': '1472x640',
    '4:3': '1120x832',
    '1:1': '960x960',
    '3:4': '832x1120',
    '9:16': '736x1280',
  },
  '2.0': {
    '16:9': '1920x1088',
    '21:9': '2208x960',
    '4:3': '1664x1248',
    '1:1': '1440x1440',
    '3:4': '1248x1664',
    '9:16': '1088x1920',
  },
} as const

export interface CustomMockCatalog {
  video: readonly UpaiModel[]
  image: readonly UpaiModel[]
  isReachable: boolean
}

export interface CustomMockCatalogParams {
  scenario: CustomMockScenario
}

export interface CustomMockOptions {
  instanceId: string
  scenario?: CustomMockScenario
}

/** Explicit scenario, else the demo instance suffix, else a ready endpoint. */
export function customMockScenario(options: CustomMockOptions): CustomMockScenario {
  return options.scenario ?? customMockScenarioFor(options.instanceId) ?? 'ready'
}

/** Scenario from a demo instance id. Any other instance uses `ready`. */
function customMockScenarioFor(instanceId: string): CustomMockScenario | null {
  if (!instanceId.startsWith(MOCK_INSTANCE_PREFIX)) {
    return null
  }

  const suffix = instanceId.slice(MOCK_INSTANCE_PREFIX.length)

  if (!isOneOf(CUSTOM_MOCK_SCENARIOS, suffix)) {
    return null
  }

  return suffix
}

/** Fixture models plus the synthetic stale and invalid entries. */
export function customMockCatalog(params: CustomMockCatalogParams): CustomMockCatalog {
  const { scenario } = params
  const fixtures = customMockFixtures()
  const video = scaleVideoModels(fixtures.videoModels)
  const image = fixtures.imageModels

  if (scenario === 'unreachable') {
    return { video, image, isReachable: false }
  }

  if (scenario === 'stale') {
    return { video: staleVideoModels(video), image, isReachable: true }
  }

  if (scenario === 'invalid') {
    return { video, image: [...image, ...fixtures.invalidModels], isReachable: true }
  }

  return { video, image, isReachable: true }
}

/** A ready video model with scale resolutions, so the picker shows pixel labels. */
function scaleVideoModels(models: readonly UpaiModel[]): readonly UpaiModel[] {
  const [base] = models

  if (isNil(base)) {
    return models
  }

  const scale: UpaiModel = {
    ...base,
    id: 'minimax-h3-scale',
    name: 'MiniMax H3 Scale (local)',
    description: '',
    status: 'ready',
    status_reason: null,
    capabilities: {
      ...base.capabilities,
      resolutions: [...SCALE_RESOLUTIONS],
      default_resolution: '0.9',
      aspect_ratios: [...SCALE_ASPECTS],
      default_aspect_ratio: '16:9',
      sizes: SCALE_SIZES,
      duration: { min: 4, max: 15, default: 5, step: 1 },
      fps: 24,
    },
  }

  return [...models, scale]
}

function staleVideoModels(models: readonly UpaiModel[]): readonly UpaiModel[] {
  const [first, ...rest] = models

  if (isNil(first)) {
    return models
  }

  const stale: UpaiModel = {
    ...first,
    status: 'stale',
    status_reason: CUSTOM_MOCK_STALE_REASON,
  }

  return [stale, ...rest]
}

export function toProviderVideoModel(model: UpaiModel): ProviderModel {
  const caps = model.capabilities

  return {
    modelId: model.id,
    durations: durationValues(caps),
    resolutions: caps.resolutions,
    aspectRatios: caps.aspect_ratios,
    frameImages: frameImages(caps),
    generatesAudio: caps.audio_output ?? null,
    hasSeed: caps.seed,
  }
}

export function toProviderImageModel(model: UpaiModel): ProviderImageModel {
  const caps = model.capabilities

  return {
    modelId: model.id,
    resolutions: caps.resolutions,
    aspectRatios: caps.aspect_ratios,
    qualities: null,
    backgrounds: null,
    maxN: caps.count?.max ?? null,
    referenceMax: caps.references.image.max,
    hasSeed: caps.seed,
  }
}

function durationValues(caps: UpaiCapabilities): readonly number[] | null {
  const duration = caps.duration

  if (isNil(duration)) {
    return null
  }

  let step = 1

  if (duration.step > 1) {
    step = Math.floor(duration.step)
  }

  const count = Math.floor((duration.max - duration.min) / step) + 1

  return Array.from({ length: Math.max(0, count) }, (_, index) => {
    return duration.min + index * step
  })
}

function frameImages(caps: UpaiCapabilities): readonly string[] | null {
  const frames = caps.frames

  if (isNil(frames) || !frames.start) {
    return null
  }

  if (frames.end) {
    return ['first_frame', 'last_frame']
  }

  return ['first_frame']
}

export interface CustomMockEndpointSignalParams {
  catalog: CustomMockCatalog
  modelId: string
}

export function customMockEndpointSignal(params: CustomMockEndpointSignalParams): EndpointSignal {
  const { catalog, modelId } = params

  if (!catalog.isReachable) {
    return { state: 'unknown', reason: 'ComfyUI is not reachable.' }
  }

  const isPresent = [...catalog.video, ...catalog.image].some((model) => {
    return model.id === modelId
  })

  if (isPresent) {
    return { state: 'present', reason: null }
  }

  return { state: 'not_found', reason: null }
}
