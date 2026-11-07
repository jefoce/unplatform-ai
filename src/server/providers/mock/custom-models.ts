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
  const video = fixtures.videoModels
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
