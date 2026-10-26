import { isNil } from 'lodash-es'
import { beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { MODEL_PRESETS } from '@/core/presets'
import type { ModelPreset } from '@/core/presets/types'
import type { ProviderModel } from '@/server/providers/types'

const MODELS_URL = 'https://openrouter.ai/api/v1/videos/models'
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

type ModelResponse = z.infer<typeof ModelSchema>

const isLive = process.env.LIVE_CATALOG === '1'

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

function assertBinding(preset: ModelPreset, model: ProviderModel): void {
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
  }, TEST_TIMEOUT_MS)

  it('matches every preset binding', () => {
    for (const preset of MODEL_PRESETS) {
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
})
