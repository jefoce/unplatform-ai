import { describe, expect, it } from 'vitest'

import { revealLabel } from '../src/lib/platform/reveal-label'

describe('reveal label', () => {
  it('names the file manager of each platform', () => {
    expect(revealLabel('darwin')).toBe('Reveal in Finder')
    expect(revealLabel('win32')).toBe('Show in Explorer')
    expect(revealLabel('linux')).toBe('Show in folder')
  })

  it('falls back to a folder label before the platform loads', () => {
    expect(revealLabel()).toBe('Show in folder')
    expect(revealLabel('freebsd')).toBe('Show in folder')
  })
})
