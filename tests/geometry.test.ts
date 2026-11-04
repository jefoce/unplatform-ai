import { describe, expect, it } from 'vitest'

import { aspectSize, parseAspect, type PixelSize } from '../src/core/media/geometry'

describe('parseAspect', () => {
  it('reads both sides of a ratio', () => {
    expect(parseAspect('16:9')).toEqual([16, 9])
    expect(parseAspect('1:1')).toEqual([1, 1])
  })

  it('rejects auto, malformed and non-positive ratios', () => {
    expect(parseAspect('auto')).toBeNull()
    expect(parseAspect('bad')).toBeNull()
    expect(parseAspect('0:9')).toBeNull()
    expect(parseAspect('16:-9')).toBeNull()
  })
})

const SIZE_CASES: [string, PixelSize][] = [
  ['1:1', { width: 1, height: 1 }],
  ['3:2', { width: 3, height: 2 }],
  ['16:9', { width: 16, height: 9 }],
  ['2.5:1', { width: 2.5, height: 1 }],
  ['bad', { width: 1, height: 1 }],
  ['auto', { width: 1, height: 1 }],
]

describe('aspectSize', () => {
  it.each(SIZE_CASES)('turns %s into a pixel size', (aspect, size) => {
    expect(aspectSize(aspect)).toEqual(size)
  })
})
