import { describe, expect, it } from 'vitest'

import { joinWords } from '@/core/text'

const AND_CASES: [string[], string][] = [
  [[], ''],
  [['image'], 'image'],
  [['image', 'video'], 'image and video'],
  [['image', 'video', 'audio'], 'image, video, and audio'],
  [['a', 'b', 'c', 'd'], 'a, b, c, and d'],
]

const OR_CASES: [string[], string][] = [
  [[], ''],
  [['image'], 'image'],
  [['image', 'video'], 'image or video'],
  [['image', 'video', 'audio'], 'image, video, or audio'],
  [['a', 'b', 'c', 'd'], 'a, b, c, or d'],
]

describe('joinWords', () => {
  it.each(AND_CASES)('joins %j with and', (items, expected) => {
    expect(joinWords(items, 'and')).toBe(expected)
  })

  it.each(OR_CASES)('joins %j with or', (items, expected) => {
    expect(joinWords(items, 'or')).toBe(expected)
  })
})
