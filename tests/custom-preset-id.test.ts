import { describe, expect, it } from 'vitest'

import { isCustomPresetId } from '../src/core/presets/custom'

describe('isCustomPresetId', () => {
  it('accepts an id built by presetIdFor', () => {
    expect(isCustomPresetId('custom.a.b')).toBe(true)
  })

  it('rejects provider ids without the prefix', () => {
    expect(isCustomPresetId('openrouter')).toBe(false)
    expect(isCustomPresetId('wan-3.0')).toBe(false)
    expect(isCustomPresetId('custom')).toBe(false)
    expect(isCustomPresetId('customx.y')).toBe(false)
  })
})
