import { describe, expect, it } from 'vitest'

import {
  REFERENCE_ALREADY_ATTACHED,
  REFERENCE_LIMIT_REACHED,
  REFERENCE_ONLY_IMAGES,
  referenceBlockReason,
  referenceRoom,
} from '@/features/generator/reference-rules'

import { getPreset } from '../src/core/presets'
import { upload, uploadsOf } from './helpers/validation-fixtures'

const preset = getPreset('wan-3.0')

const image = upload('image-1', 'image')
const video = upload('video-1', 'video')
const audio = upload('audio-1', 'audio')

const uploads = uploadsOf(image, video, audio)

describe('referenceRoom', () => {
  it('counts free slots per kind from a partial list', () => {
    expect(
      referenceRoom({ preset, references: [image.id, video.id], uploadsById: uploads }),
    ).toEqual({
      image: preset.references.image - 1,
      video: preset.references.video - 1,
      audio: preset.references.audio,
    })
  })

  it('is zero for a kind that is full', () => {
    const oneImage = { ...preset, references: { ...preset.references, image: 1 } }

    expect(
      referenceRoom({ preset: oneImage, references: [image.id], uploadsById: uploads }).image,
    ).toBe(0)
  })
})

describe('referenceBlockReason', () => {
  it('names a kind the model does not take', () => {
    expect(referenceBlockReason({ kind: 'image', max: 0, room: 0 })).toBe(
      'This model does not take image references',
    )
  })

  it('reports a full kind', () => {
    expect(referenceBlockReason({ kind: 'audio', max: 1, room: 0 })).toBe(REFERENCE_LIMIT_REACHED)
  })

  it('reports an attached reference', () => {
    expect(referenceBlockReason({ kind: 'image', max: 1, room: 1, isAttached: true })).toBe(
      REFERENCE_ALREADY_ATTACHED,
    )
  })

  it('keeps the image picker wording for a foreign kind', () => {
    expect(referenceBlockReason({ kind: 'video', max: 0, room: 0, isImageOnly: true })).toBe(
      REFERENCE_ONLY_IMAGES,
    )
  })

  it('is null when the kind has room', () => {
    expect(referenceBlockReason({ kind: 'image', max: 1, room: 1 })).toBeNull()
  })
})
