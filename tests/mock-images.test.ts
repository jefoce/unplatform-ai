import { randomUUID } from 'node:crypto'

import { isNil } from 'lodash-es'
import { describe, expect, it } from 'vitest'

import sharp from '@/server/media/sharp'
import { createMockImageProvider } from '@/server/providers/mock/images'
import type { ImageResultItem } from '@/server/providers/types'

import { IMAGE_PRESETS } from '../src/core/presets/image'
import type { ImagePreset } from '../src/core/presets/image/types'
import type { ImageGenerationInput } from '../src/core/schemas/image-record'

const PRESET: ImagePreset = IMAGE_PRESETS[0]

function input(overrides: Partial<ImageGenerationInput> = {}): ImageGenerationInput {
  return {
    presetId: PRESET.id,
    prompt: 'a cat',
    count: 2,
    aspectRatio: '16:9',
    resolution: '1K',
    quality: null,
    background: null,
    references: [],
    seed: null,
    ...overrides,
  }
}

function b64Of(item: ImageResultItem | undefined): string {
  if (isNil(item) || !('b64' in item)) {
    return ''
  }

  return item.b64
}

async function sizeOf(b64: string): Promise<{ width: number; height: number } | null> {
  const meta = await sharp(Buffer.from(b64, 'base64')).metadata()

  if (isNil(meta.width) || isNil(meta.height)) {
    return null
  }

  return { width: meta.width, height: meta.height }
}

describe('mock image provider', () => {
  it('generates one png per count at the requested size', async () => {
    const result = await createMockImageProvider().generate({
      preset: PRESET,
      input: input(),
      references: [],
    })

    expect(result.items).toHaveLength(2)
    expect(result.costUsd).toBe(0)

    const size = await sizeOf(b64Of(result.items[0]))

    expect(size).toEqual({ width: 1820, height: 1024 })
  })

  it('uses a square for auto', async () => {
    const result = await createMockImageProvider().generate({
      preset: PRESET,
      input: input({ aspectRatio: 'auto', resolution: null, count: 1 }),
      references: [],
    })

    expect(await sizeOf(b64Of(result.items[0]))).toEqual({ width: 1024, height: 1024 })
  })

  it('fails only the first call for a [fail] prompt', async () => {
    const provider = createMockImageProvider()

    const params = {
      preset: PRESET,
      input: input({ prompt: `[fail] ${randomUUID()}` }),
      references: [],
    }

    await expect(provider.generate(params)).rejects.toMatchObject({ kind: 'server' })
    await expect(provider.generate(params)).resolves.toMatchObject({ costUsd: 0 })
  })

  it('lists every preset as available', async () => {
    const list = await createMockImageProvider().listModels()

    expect(list.isFresh).toBe(true)
    expect(list.models[0]?.modelId).toBe(PRESET.bindings[0].modelId)
  })
})
