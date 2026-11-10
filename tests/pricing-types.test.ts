import { describe, expect, it } from 'vitest'

import { PRICING_KINDS } from '@/server/pricing/live'

import {
  ASPECT_BUCKETS,
  PRICING_FORMULAS,
  QUOTE_SOURCES,
  QUOTE_UNITS,
} from '../src/core/pricing/types'

describe('pricing type lists', () => {
  it('keeps the generic lists in one place', () => {
    expect(ASPECT_BUCKETS).toEqual(['square', 'wide', 'tall'])

    expect(PRICING_FORMULAS).toEqual([
      'perSecond',
      'videoTokens',
      'perImage',
      'imageTokens',
      'perRun',
    ])

    expect(QUOTE_UNITS).toEqual(['second', 'image', 'token', 'run'])
    expect(QUOTE_SOURCES).toEqual(['live', 'fallback'])
    expect(PRICING_KINDS).toEqual(['video', 'image'])
  })
})
