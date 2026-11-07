import { describe, expect, it } from 'vitest'

import { showPrice } from '../src/core/pricing/visibility'

describe('price visibility', () => {
  it('hides a local zero price', () => {
    expect(showPrice({ local: true }, 0)).toBe(false)
  })

  it('shows a local override', () => {
    expect(showPrice({ local: true }, 0.5)).toBe(true)
  })

  it('shows an API zero price', () => {
    expect(showPrice({ local: false }, 0)).toBe(true)
  })
})
