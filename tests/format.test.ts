import { describe, expect, it } from 'vitest'

import { formatAgo } from '@/lib/format'

const NOW = Date.parse('2026-10-26T12:00:00.000Z')

function ago(ms: number): string {
  return new Date(NOW - ms).toISOString()
}

describe('formatAgo', () => {
  it('keeps the first minute short', () => {
    expect(formatAgo(ago(30_000), NOW)).toBe('just now')
  })

  it('clamps a future timestamp to just now', () => {
    expect(formatAgo(ago(-30_000), NOW)).toBe('just now')
  })

  it('counts minutes', () => {
    expect(formatAgo(ago(90_000), NOW)).toBe('1 min ago')
  })

  it('counts hours', () => {
    expect(formatAgo(ago(2 * 3_600_000), NOW)).toBe('2 h ago')
  })

  it('counts days', () => {
    expect(formatAgo(ago(3 * 86_400_000), NOW)).toBe('3 d ago')
  })
})
