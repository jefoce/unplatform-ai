import { describe, expect, it } from 'vitest'

import { ImageSubmitSchema } from '../src/core/api/image'
import type { ImageGenerationInput } from '../src/core/schemas/image-record'
import { imageInputFromState } from '../src/features/image-generator/image-submit-input'

const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

const INPUT: ImageGenerationInput = {
  presetId: 'flux-3-image-klein',
  prompt: 'a cat',
  count: 2,
  aspectRatio: '1:1',
  resolution: '1K',
  quality: null,
  background: null,
  references: [UUID],
  seed: 42,
}

const STATE = {
  ...INPUT,
  uploadsById: { [UUID]: { id: UUID, kind: 'image' } },
  setPrompt: () => {},
}

describe('image submit body', () => {
  it('sends exactly the schema keys', () => {
    const body = imageInputFromState(STATE)

    expect(Object.keys(body).sort()).toEqual(Object.keys(ImageSubmitSchema.shape).sort())
    expect(ImageSubmitSchema.safeParse(body).success).toBe(true)
  })

  it('rejects a store-only field at the schema boundary', () => {
    const body = imageInputFromState(STATE)
    const parsed = ImageSubmitSchema.safeParse({ ...body, uploadsById: STATE.uploadsById })

    expect(parsed.success).toBe(false)
  })
})
