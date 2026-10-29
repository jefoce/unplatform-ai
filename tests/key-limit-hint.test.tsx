// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { CreditsInfo } from '@/core/types'
import { KeyLimitHint } from '@/features/settings/KeyLimitHint'

const HINT =
  "This key has no spend limit. Set one on OpenRouter, so a leaked key can't cost more than you allow."

function credits(overrides: Partial<CreditsInfo>): CreditsInfo {
  return {
    balance: null,
    keyLimitRemaining: null,
    keyLimit: null,
    usageDaily: null,
    usageMonthly: null,
    localSpent: 0,
    source: 'key',
    fetchedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
})

describe('KeyLimitHint', () => {
  it('shows the hint when a key is loaded and has no spend limit', () => {
    render(<KeyLimitHint credits={credits({ source: 'key', keyLimit: null })} />)

    expect(screen.getByText(HINT)).toBeTruthy()
  })

  it('hides the hint when there is no key', () => {
    render(<KeyLimitHint credits={credits({ source: 'none' })} />)

    expect(screen.queryByText(HINT)).toBeNull()
  })

  it('hides the hint for the mock account', () => {
    render(<KeyLimitHint credits={credits({ source: 'mock' })} />)

    expect(screen.queryByText(HINT)).toBeNull()
  })

  it('hides the hint when the key has a spend limit', () => {
    render(<KeyLimitHint credits={credits({ keyLimit: 0 })} />)

    expect(screen.queryByText(HINT)).toBeNull()
  })

  it('hides the hint while the account is unknown or in error', () => {
    const { rerender } = render(<KeyLimitHint credits={undefined} />)

    expect(screen.queryByText(HINT)).toBeNull()

    rerender(<KeyLimitHint credits={credits({ error: 'Credits request failed' })} />)

    expect(screen.queryByText(HINT)).toBeNull()
  })
})
