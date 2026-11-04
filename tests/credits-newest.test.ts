import { describe, expect, it } from 'vitest'

import type { CreditsInfo } from '@/core/types'
import { keepNewestCredits } from '@/lib/api/credits'

function creditsAt(fetchedAt: string, balance: number): CreditsInfo {
  return {
    balance,
    keyLimitRemaining: null,
    keyLimit: null,
    usageDaily: null,
    usageMonthly: null,
    localSpent: 0,
    localSpentUnknown: 0,
    source: 'management',
    fetchedAt,
  }
}

describe('credits fetchedAt guard', () => {
  it('keeps the newer response when an older one arrives after it', () => {
    const newer = creditsAt('2026-01-01T00:00:02.000Z', 20)
    const older = creditsAt('2026-01-01T00:00:01.000Z', 30)

    expect(keepNewestCredits(newer, older)).toBe(newer)
  })

  it('accepts a response newer than the stored one', () => {
    const older = creditsAt('2026-01-01T00:00:01.000Z', 30)
    const newer = creditsAt('2026-01-01T00:00:02.000Z', 20)

    expect(keepNewestCredits(older, newer)).toBe(newer)
  })
})
