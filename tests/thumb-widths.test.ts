import { describe, expect, it } from 'vitest'

import { THUMB_ENCODER_VERSION } from '../src/core/constants'
import { imageThumbForWidth, posterForWidth } from '../src/lib/feed/output-items'
import { thumbCacheKey } from '../src/server/media/thumbs'
import { record } from './helpers/history'
import { imageItemsOf } from './helpers/image-history'
import { required } from './helpers/required'

const imageWidth = (mediaWidth: number, devicePixelRatio: number): number => {
  const item = required(imageItemsOf(['a'])[0], 'image item')
  const src = imageThumbForWidth({ item, mediaWidth, devicePixelRatio })

  return Number(new URL(src, 'http://localhost').searchParams.get('w'))
}

const posterWidth = (mediaWidth: number, devicePixelRatio: number): number => {
  const src = required(
    posterForWidth({ record: record('clip'), mediaWidth, devicePixelRatio }),
    'poster src',
  )

  return Number(new URL(src, 'http://localhost').searchParams.get('w'))
}

describe('measured thumb widths', () => {
  it('rounds image width times DPR up to the next 80 px bucket', () => {
    expect(imageWidth(400, 1)).toBe(400)
    expect(imageWidth(401, 1)).toBe(480)
    expect(imageWidth(401, 2)).toBe(880)
    expect(imageWidth(500, 2)).toBe(1040)
  })

  it('rounds video width times DPR up to the next poster bucket', () => {
    expect(posterWidth(320, 1)).toBe(320)
    expect(posterWidth(401, 1)).toBe(640)
    expect(posterWidth(401, 2)).toBe(960)
    expect(posterWidth(700, 2)).toBe(1600)
    expect(posterWidth(1601, 1)).toBe(1920)
  })
})

describe('thumb cache key', () => {
  it('changes with the encoder version', () => {
    const params = { ref: 'downloads/clip.preview.webp', mtimeMs: 1, width: 800 }
    const current = thumbCacheKey(params)
    const next = thumbCacheKey({ ...params, encoderVersion: THUMB_ENCODER_VERSION + 1 })

    expect(thumbCacheKey({ ...params, encoderVersion: THUMB_ENCODER_VERSION })).toBe(current)
    expect(next).not.toBe(current)
  })
})
