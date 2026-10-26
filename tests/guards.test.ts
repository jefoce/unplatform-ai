import { describe, expect, it } from 'vitest'

import { isOneOf } from '@/core/guards'

const COLORS = ['red', 'green'] as const

describe('isOneOf', () => {
  it('accepts a member', () => {
    expect(isOneOf(COLORS, 'red')).toBe(true)
  })

  it('rejects a non-member', () => {
    expect(isOneOf(COLORS, 'blue')).toBe(false)
  })

  it('rejects a non-string', () => {
    expect(isOneOf(COLORS, 1)).toBe(false)
  })

  it('rejects every value for an empty list', () => {
    expect(isOneOf([], 'red')).toBe(false)
  })
})
