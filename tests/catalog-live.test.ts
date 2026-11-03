import { writeFile } from 'node:fs/promises'

import { isNil } from 'lodash-es'
import { beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import type { ProviderModel } from '@/server/providers/types'

import { VIDEO_PRESETS } from '../src/core/presets'
import { IMAGE_PRESETS } from '../src/core/presets/image'
import type { VideoPreset } from '../src/core/presets/video/types'
import { IMAGE_BILLABLE_KINDS, PRICE_UNITS } from '../src/core/pricing/types'

const MODELS_URL = 'https://openrouter.ai/api/v1/videos/models'
const IMAGE_MODELS_URL = 'https://openrouter.ai/api/v1/images/models'
const FIXTURE_URL = new URL('./fixtures/image-live-prices.json', import.meta.url)
const FETCH_TIMEOUT_MS = 30_000
const TEST_TIMEOUT_MS = 35_000

const ModelSchema = z
  .object({
    id: z.string(),
    supported_durations: z.array(z.number()).nullable().optional(),
    supported_resolutions: z.array(z.string()).nullable().optional(),
    supported_aspect_ratios: z.array(z.string()).nullable().optional(),
    supported_frame_images: z.array(z.string()).nullable().optional(),
    generate_audio: z.boolean().nullable().optional(),
    seed: z.boolean().nullable().optional(),
  })
  .loose()

const ModelsSchema = z.object({ data: z.array(ModelSchema) }).loose()

const ImageLineSchema = z
  .object({
    billable: z.enum(IMAGE_BILLABLE_KINDS),
    unit: z.enum(PRICE_UNITS),
    cost_usd: z.number(),
    variant: z.string().nullish(),
  })
  .loose()

const ImageEndpointSchema = z.object({ pricing: z.array(ImageLineSchema).nullish() }).loose()

const ImageEndpointsSchema = z
  .object({ data: z.object({ endpoints: z.array(z.unknown()) }).loose() })
  .loose()

type ModelResponse = z.infer<typeof ModelSchema>

const isLive = process.env.LIVE_CATALOG === '1'
const isWriteFixture = process.env.WRITE_IMAGE_PRICE_FIXTURE === '1'

function toModel(model: ModelResponse): ProviderModel {
  return {
    modelId: model.id,
    durations: model.supported_durations ?? null,
    resolutions: model.supported_resolutions ?? null,
    aspectRatios: model.supported_aspect_ratios ?? null,
    frameImages: model.supported_frame_images ?? null,
    generatesAudio: model.generate_audio ?? null,
    hasSeed: model.seed ?? null,
  }
}

function expectSupported(
  presetId: string,
  field: string,
  value: string | number,
  supported: readonly (string | number)[] | null,
): void {
  expect(supported ?? [], `${presetId} ${field} ${value}`).toContain(value)
}

function expectFlag(
  presetId: string,
  field: string,
  isActual: boolean | null,
  isExpected: boolean,
): void {
  expect(isActual, `${presetId} ${field}`).toBe(isExpected)
}

function assertBinding(preset: VideoPreset, model: ProviderModel): void {
  for (const value of preset.duration.options ?? []) {
    expectSupported(preset.id, 'duration.options', value, model.durations)
  }

  for (const [field, value] of [
    ['duration.min', preset.duration.min],
    ['duration.max', preset.duration.max],
  ] as const) {
    expectSupported(preset.id, field, value, model.durations)
  }

  for (const resolution of preset.resolutions) {
    expectSupported(preset.id, 'resolutions', resolution, model.resolutions)
  }

  for (const aspectRatio of preset.aspectRatios) {
    expectSupported(preset.id, 'aspectRatios', aspectRatio, model.aspectRatios)
  }

  expectFlag(
    preset.id,
    'frames.start',
    model.frameImages?.includes('first_frame') ?? null,
    preset.frames.start,
  )

  expectFlag(
    preset.id,
    'frames.end',
    model.frameImages?.includes('last_frame') ?? null,
    preset.frames.end,
  )

  expectFlag(preset.id, 'audio.supported', model.generatesAudio, preset.audio.supported)
  expectFlag(preset.id, 'seed', model.hasSeed, preset.seed)
}

describe.skipIf(!isLive)('live OpenRouter catalog', () => {
  const models = new Map<string, ProviderModel>()
  const imagePrices = new Map<string, Record<string, number>>()

  beforeAll(async () => {
    const res = await fetch(MODELS_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })

    expect(res.ok, `OpenRouter ${res.status} ${res.statusText}`).toBe(true)

    const parsed = ModelsSchema.safeParse(await res.json())

    if (!parsed.success) {
      throw new Error(`Invalid /videos/models response: ${parsed.error.message}`)
    }

    for (const model of parsed.data.data) {
      models.set(model.id, toModel(model))
    }

    for (const preset of IMAGE_PRESETS) {
      const modelId = preset.bindings[0].modelId

      imagePrices.set(modelId, await fetchImagePrices(modelId))
    }

    if (isWriteFixture) {
      const sorted = Object.fromEntries(
        [...imagePrices].sort(([left], [right]) => {
          return left.localeCompare(right)
        }),
      )

      await writeFile(FIXTURE_URL, `${JSON.stringify(sorted, null, 2)}\n`)
    }
  }, TEST_TIMEOUT_MS)

  it('matches every preset binding', () => {
    for (const preset of VIDEO_PRESETS) {
      for (const binding of preset.bindings) {
        const model = models.get(binding.modelId)

        expect(model, `${preset.id} modelId ${binding.modelId} is missing`).toBeDefined()

        if (isNil(model)) {
          continue
        }

        assertBinding(preset, model)
      }
    }
  })

  it('matches every image preset fallback exactly', () => {
    for (const preset of IMAGE_PRESETS) {
      const live = imagePrices.get(preset.bindings[0].modelId)

      expect(live, `${preset.id} endpoints are missing`).toBeDefined()

      if (isNil(live)) {
        continue
      }

      for (const [key, rate] of Object.entries(preset.bindings[0].pricing.fallback)) {
        const liveRate = live[key]

        expect(liveRate, `${preset.id} ${key} is missing live`).toBeDefined()

        if (isNil(liveRate)) {
          continue
        }

        expect(rate, `${preset.id} ${key} drifted`).toBe(liveRate)
      }
    }
  })
})

/** Highest rate per billable/variant/unit key across every endpoint. */
async function fetchImagePrices(modelId: string): Promise<Record<string, number>> {
  const res = await fetch(`${IMAGE_MODELS_URL}/${modelId}/endpoints`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })

  expect(res.ok, `OpenRouter ${res.status} ${res.statusText}`).toBe(true)

  const parsed = ImageEndpointsSchema.safeParse(await res.json())

  if (!parsed.success) {
    throw new Error(`Invalid image endpoints for ${modelId}: ${parsed.error.message}`)
  }

  const prices: Record<string, number> = {}

  for (const item of parsed.data.data.endpoints) {
    const endpoint = ImageEndpointSchema.safeParse(item)

    if (!endpoint.success) {
      continue
    }

    for (const line of endpoint.data.pricing ?? []) {
      const key = `${line.billable}_${line.variant?.toLowerCase() ?? 'base'}_${line.unit}`

      prices[key] = Math.max(prices[key] ?? 0, line.cost_usd)
    }
  }

  return prices
}
