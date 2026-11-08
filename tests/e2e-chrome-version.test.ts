import { describe, expect, it, vi } from 'vitest'

import { checkChromeMajor, parseChromeMajor } from './e2e/lib/chrome-version.mjs'

describe('parseChromeMajor', () => {
  it('reads the major from a Chrome string', () => {
    expect(parseChromeMajor('Chrome/156.0.8078.79')).toBe(156)
  })

  it('reads the major from a HeadlessChrome string', () => {
    expect(parseChromeMajor('HeadlessChrome/156.0.8078.79')).toBe(156)
  })

  it('returns null when the value does not parse', () => {
    expect(parseChromeMajor('Chromium/156')).toBeNull()
    expect(parseChromeMajor('')).toBeNull()
  })
})

describe('checkChromeMajor', () => {
  it('names both majors when the versions differ', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})

    expect(() => {
      checkChromeMajor('Chrome/155.0.1.2', '156')
    }).toThrow(/155.*156/)
  })
})
