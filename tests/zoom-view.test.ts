import { describe, expect, it } from 'vitest'

import { isSameView, nextView } from '@/ui/use-zoom-layer'
import type { ZoomView } from '@/ui/zoom-math'

const VIEW: ZoomView = {
  layerWidth: 800,
  layerHeight: 600,
  contentLeft: 100,
  contentTop: 75,
  contentWidth: 600,
  contentHeight: 450,
}

const CHANGED: ZoomView = {
  layerWidth: 801,
  layerHeight: 601,
  contentLeft: 101,
  contentTop: 76,
  contentWidth: 601,
  contentHeight: 451,
}

const FIELDS = [
  'layerWidth',
  'layerHeight',
  'contentLeft',
  'contentTop',
  'contentWidth',
  'contentHeight',
] as const

describe('isSameView', () => {
  it('is true for equal views', () => {
    expect(isSameView(VIEW, { ...VIEW })).toBe(true)
  })

  it.each(FIELDS)('is false when %s differs', (field) => {
    expect(isSameView(VIEW, { ...VIEW, [field]: CHANGED[field] })).toBe(false)
  })
})

describe('nextView', () => {
  it('returns the current reference when the view is unchanged', () => {
    expect(nextView(VIEW, { ...VIEW })).toBe(VIEW)
  })

  it('returns the next view when it changed', () => {
    expect(nextView(VIEW, CHANGED)).toBe(CHANGED)
  })
})
