import 'server-only'

import { isNil } from 'lodash-es'

import { isKeyOf } from '@/core/guards'
import { aspectSize, type PixelSize } from '@/core/media/geometry'
import { primaryBinding } from '@/core/presets/common/bindings'
import { IMAGE_PRESETS } from '@/core/presets/image'
import type { ImageParam, ImagePreset, ImageResolution } from '@/core/presets/image/types'
import type { ImageGenerationInput } from '@/core/schemas/image-record'
import type { TestResult } from '@/core/types'

import { globalState } from '../../global-state'
import sharp from '../../media/sharp'
import { ProviderError } from '../provider-error'
import type {
  EndpointSignal,
  ImageGenerateParams,
  ImageProvider,
  ImageResult,
  ProviderImageModel,
  ProviderImageModelList,
} from '../types'

const SHORT_SIDE: Record<ImageResolution, number> = {
  '512': 512,
  '768': 768,
  '1K': 1024,
  '1.5K': 1536,
  '2K': 2048,
  '4K': 4096,
}

const DEFAULT_SHORT_SIDE = 1024

const failures = globalState<Map<string, number>>('mockImageFailures', () => {
  return new Map()
})

/** Mock OpenRouter image adapter. Writes a solid PNG per requested image. */
export function createMockImageProvider(): ImageProvider {
  return {
    id: 'openrouter',
    isConfigured,
    generate,
    listModels,
    listEndpoints,
    testConnection,
  }
}

async function listEndpoints(): Promise<EndpointSignal> {
  return { state: 'present', reason: null }
}

function isConfigured(): boolean {
  return true
}

function isFirstFailure(prompt: string): boolean {
  const isMarked = prompt.includes('[fail]')

  if (!isMarked) {
    return false
  }

  const seen = failures.get(prompt) ?? 0

  failures.set(prompt, seen + 1)

  return seen === 0
}

function sizeFor(input: ImageGenerationInput): PixelSize {
  const ratio = aspectSize(input.aspectRatio)
  let shortSide = DEFAULT_SHORT_SIDE

  if (!isNil(input.resolution) && isKeyOf(SHORT_SIDE, input.resolution)) {
    shortSide = SHORT_SIDE[input.resolution]
  }

  const longSide = Math.round(
    (shortSide * Math.max(ratio.width, ratio.height)) / Math.min(ratio.width, ratio.height),
  )

  if (ratio.width >= ratio.height) {
    return { width: longSide, height: shortSide }
  }

  return { width: shortSide, height: longSide }
}

function colorFor(prompt: string, index: number): string {
  let hash = index

  for (const char of prompt) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 0xffffff
  }

  return `#${hash.toString(16).padStart(6, '0')}`
}

/** Mirrors OpenRouter: a field the preset does not declare fails the request. */
export function assertDeclaredFields(params: ImageGenerateParams): void {
  const { preset, input, references } = params
  const attempted: ImageParam[] = []

  if (!isNil(input.resolution)) {
    attempted.push('resolution')
  }

  if (!isNil(input.quality)) {
    attempted.push('quality')
  }

  if (!isNil(input.background)) {
    attempted.push('background')
  }

  if (!isNil(input.seed)) {
    attempted.push('seed')
  }

  if (references.length > 0) {
    attempted.push('input_references')
  }

  if (input.count > 0) {
    attempted.push('n')
  }

  const unsupported = attempted.find((field) => {
    return !preset.params.includes(field)
  })

  if (isNil(unsupported)) {
    return
  }

  const modelId = primaryBinding(preset).modelId
  const message = `${modelId} does not support: ${unsupported}.`

  throw new ProviderError({
    providerId: 'openrouter',
    kind: 'input',
    message,
    storedMessage: message,
    status: 400,
    code: null,
  })
}

async function generate(params: ImageGenerateParams): Promise<ImageResult> {
  const { input } = params

  assertDeclaredFields(params)

  if (isFirstFailure(input.prompt)) {
    throw new ProviderError({
      providerId: 'openrouter',
      kind: 'server',
      message: 'Mock image failure',
      storedMessage: 'Mock image failure',
      status: 500,
      code: null,
    })
  }

  const size = sizeFor(input)

  const items = await Promise.all(
    Array.from({ length: input.count }, async (_, index) => {
      const png = await sharp({
        create: {
          width: size.width,
          height: size.height,
          channels: 3,
          background: colorFor(input.prompt, index),
        },
      })
        .png()
        .toBuffer()

      return { b64: png.toString('base64'), mediaType: 'image/png' as const }
    }),
  )

  return { items, costUsd: 0 }
}

function providerModel(preset: ImagePreset): ProviderImageModel {
  return {
    modelId: primaryBinding(preset).modelId,
    resolutions:
      preset.resolutions?.map((option) => {
        return option.value
      }) ?? null,
    aspectRatios: preset.aspectRatios,
    qualities:
      preset.qualities?.map((option) => {
        return option.value
      }) ?? null,
    backgrounds:
      preset.backgrounds?.map((option) => {
        return option.value
      }) ?? null,
    maxN: preset.maxN,
    referenceMax: preset.referenceMax,
    hasSeed: preset.seed,
  }
}

async function listModels(): Promise<ProviderImageModelList> {
  return { models: IMAGE_PRESETS.map(providerModel), isFresh: true }
}

async function testConnection(): Promise<TestResult> {
  return { ok: true, mock: true }
}
