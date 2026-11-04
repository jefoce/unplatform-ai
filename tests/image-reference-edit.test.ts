import { beforeEach, describe, expect, it } from 'vitest'

import { useImageGeneratorStore } from '@/features/image-generator/store'

import { upload, uploadsOf } from './helpers/validation-fixtures'

const first = upload('image-1', 'image')
const second = upload('image-2', 'image')
const third = upload('image-3', 'image')

beforeEach(() => {
  useImageGeneratorStore.setState({
    references: [first.id, second.id, third.id],
    uploadsById: uploadsOf(first, second, third),
  })
})

describe('image reference edits', () => {
  it('moves a reference to another slot', () => {
    useImageGeneratorStore.getState().moveReference(first.id, third.id)

    expect(useImageGeneratorStore.getState().references).toEqual([second.id, third.id, first.id])
  })

  it('keeps the slot when a reference is replaced', () => {
    const replacement = upload('image-4', 'image')

    useImageGeneratorStore.getState().replaceReference(second.id, replacement)

    expect(useImageGeneratorStore.getState().references).toEqual([
      first.id,
      replacement.id,
      third.id,
    ])

    expect(useImageGeneratorStore.getState().uploadsById[replacement.id]).toEqual(replacement)
  })
})
