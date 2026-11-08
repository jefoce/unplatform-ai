import { describe, expect, it } from 'vitest'

import { customPresetPrefix, isCustomPresetId } from '../src/core/presets/custom'

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

describe('customPresetPrefix', () => {
  it('builds the prefix that matches a preset id from that endpoint', () => {
    const prefix = customPresetPrefix('ep-1')

    expect(prefix).toBe('custom.ep-1.')
    expect(isCustomPresetId(`${prefix}wan`)).toBe(true)
  })
})
