import 'server-only'

import { aspectSize, type PixelSize } from '@/core/media/geometry'
import type { ImageGenerationInput } from '@/core/schemas/image-record'
import type { TestResult } from '@/core/types'

import sharp from '../../media/sharp'
import type {
  EndpointSignal,
  ImageGenerateParams,
  ImageProvider,
  ImageResult,
  ProviderImageModelList,
} from '../types'
import {
  customMockJobFailedError,
  customMockUnavailableError,
  customMockWorkflowInvalidError,
} from './custom-errors'
import {
  type CustomMockCatalog,
  customMockCatalog,
  customMockEndpointSignal,
  type CustomMockOptions,
  customMockScenario,
  toProviderImageModel,
} from './custom-models'

const SHORT_SIDE = 1024

const BACKGROUND = { r: 51, g: 65, b: 85 }

/** In-process upai/1 image adapter for `CUSTOM_ENDPOINT_MOCK=1`. */
export function createCustomMockImageProvider(options: CustomMockOptions): ImageProvider {
  const scenario = customMockScenario(options)

  return {
    id: 'custom',
    isConfigured,
    generate,
    listModels,
    listEndpoints,
    testConnection,
  }

  function catalog(): CustomMockCatalog {
    return customMockCatalog({ scenario })
  }

  async function generate(params: ImageGenerateParams): Promise<ImageResult> {
    assertReachable()
    assertPrompt(params.input.prompt)

    const size = sizeFor(params.input)
    const count = Math.max(1, params.input.count)

    const items = await Promise.all(
      Array.from({ length: count }, async () => {
        const png = await sharp({
          create: {
            width: size.width,
            height: size.height,
            channels: 3,
            background: BACKGROUND,
          },
        })
          .png()
          .toBuffer()

        return { b64: png.toString('base64'), mediaType: 'image/png' as const }
      }),
    )

    return { items, costUsd: 0 }
  }

  async function listModels(): Promise<ProviderImageModelList> {
    const current = catalog()

    return {
      models: current.image.map(toProviderImageModel),
      isFresh: current.isReachable,
    }
  }

  async function listEndpoints(modelId: string): Promise<EndpointSignal> {
    return customMockEndpointSignal({ catalog: catalog(), modelId })
  }

  async function testConnection(): Promise<TestResult> {
    if (!catalog().isReachable) {
      return { ok: false, error: 'ComfyUI is not reachable. Start ComfyUI, then try again.' }
    }

    return { ok: true, mock: true }
  }

  function assertReachable(): void {
    if (catalog().isReachable) {
      return
    }

    throw customMockUnavailableError()
  }
}

function isConfigured(): boolean {
  return true
}

function sizeFor(input: ImageGenerationInput): PixelSize {
  // Mock ignores resolution. A 1024 short side keeps the encode fast.
  const ratio = aspectSize(input.aspectRatio)

  const longSide = Math.round(
    (SHORT_SIDE * Math.max(ratio.width, ratio.height)) / Math.min(ratio.width, ratio.height),
  )

  if (ratio.width >= ratio.height) {
    return { width: longSide, height: SHORT_SIDE }
  }

  return { width: SHORT_SIDE, height: longSide }
}

function assertPrompt(prompt: string): void {
  if (prompt.includes('[invalid]')) {
    throw customMockWorkflowInvalidError()
  }

  if (prompt.includes('[fail]')) {
    throw customMockJobFailedError()
  }
}
