import { describe, expect, it } from 'vitest'

import { getPreset } from '@/core/presets'
import { addBlockReason, referenceRoom } from '@/features/generator/reference-rules'

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

describe('addBlockReason', () => {
  it('names a kind the model does not take', () => {
    const noImage = { ...preset, references: { ...preset.references, image: 0 } }

    expect(
      addBlockReason({
        kind: 'image',
        room: referenceRoom({ preset: noImage, references: [], uploadsById: uploads }),
        preset: noImage,
      }),
    ).toBe('This model does not take image references')
  })

  it('reports a full kind', () => {
    const oneAudio = { ...preset, references: { ...preset.references, audio: 1 } }

    expect(
      addBlockReason({
        kind: 'audio',
        room: referenceRoom({ preset: oneAudio, references: [audio.id], uploadsById: uploads }),
        preset: oneAudio,
      }),
    ).toBe('Reference limit reached')
  })

  it('is null when the kind has room', () => {
    expect(
      addBlockReason({
        kind: 'image',
        room: referenceRoom({ preset, references: [], uploadsById: uploads }),
        preset,
      }),
    ).toBeNull()
  })
})
