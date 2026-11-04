// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { unload } from 'swr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CreditsInfo } from '@/core/types'
import { CreditsBadge } from '@/features/generator/credits/CreditsBadge'
import { CreditsPopover } from '@/features/generator/credits/CreditsPopover'
import { refreshCredits, useCredits, useCreditsFocusRefresh } from '@/lib/api/credits'

const toast = vi.hoisted(() => {
  return { success: vi.fn(), error: vi.fn() }
})

vi.mock('sonner', () => {
  return { toast }
})

const fetchMock = vi.fn()
const BASE_TIME = Date.parse('2026-01-01T00:00:00.000Z')
const TEST_GAP_MS = 86_400_000

let testIndex = 0
let isHidden = false

function testNow(): number {
  return BASE_TIME + testIndex * TEST_GAP_MS
}

function iso(offsetMs: number): string {
  return new Date(testNow() + offsetMs).toISOString()
}

function creditsAt(fetchedAt: string, balance = 1): CreditsInfo {
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

function creditsResponse(credits: CreditsInfo): Response {
  return new Response(JSON.stringify(credits), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

async function flush(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

beforeEach(() => {
  testIndex += 1
  unload({ revalidate: false })
  vi.useFakeTimers()
  vi.setSystemTime(new Date(testNow()))
  isHidden = false

  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => {
      return isHidden
    },
  })

  fetchMock.mockReset()
  toast.success.mockReset()
  toast.error.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('credits shared consumers', () => {
  it('keeps the refreshed balance on the badge after the popover unmounts', async () => {
    const current = creditsAt(iso(0), 1)
    let fresh = creditsAt(iso(5000), 7)

    fetchMock.mockImplementation((url: string) => {
      return Promise.resolve(creditsResponse(url.includes('fresh=1') ? fresh : current))
    })

    const badge = render(<CreditsBadge />)

    await flush()

    const before = badge.getByRole('button', { name: '$1.00' })

    console.log(`badge before refresh: ${before.textContent ?? ''}`)

    const popover = render(<CreditsPopover />)

    await flush()

    fresh = creditsAt(iso(5000), 7)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
      await vi.advanceTimersByTimeAsync(0)
    })

    await flush()

    const after = badge.getByRole('button', { name: '$7.00' })

    console.log(`badge after refresh: ${after.textContent ?? ''}`)

    popover.unmount()

    expect(badge.getByRole('button', { name: '$7.00' }).textContent).toBe('$7.00')
  })

  it('keeps the newer balance when a later fetch returns an older fetchedAt', async () => {
    const current = creditsAt(iso(0), 1)
    const freshResponses = [creditsAt(iso(1000), 7), creditsAt(iso(500), 3)]

    fetchMock.mockImplementation((url: string) => {
      if (!url.includes('fresh=1')) {
        return Promise.resolve(creditsResponse(current))
      }

      return Promise.resolve(creditsResponse(freshResponses.shift() ?? creditsAt(iso(500), 3)))
    })

    render(<CreditsBadge />)
    render(<CreditsPopover />)

    await flush()

    await act(async () => {
      await refreshCredits(true)
    })

    await flush()
    expect(screen.getAllByText('$7.00')).toHaveLength(2)

    await act(async () => {
      await refreshCredits(true)
    })

    await flush()
    expect(screen.getAllByText('$7.00')).toHaveLength(2)
    expect(screen.queryByText('$3.00')).toBeNull()
  })
})

describe('credits focus refresh', () => {
  it('makes one fresh request for three consumers on focus', async () => {
    fetchMock.mockImplementation((url: string) => {
      return Promise.resolve(
        creditsResponse(
          url.includes('fresh=1') ? creditsAt(iso(0), 2) : creditsAt(iso(-31_000), 1),
        ),
      )
    })

    renderHook(() => {
      useCredits()
    })

    renderHook(() => {
      useCredits()
    })

    renderHook(() => {
      useCredits()
    })

    renderHook(() => {
      useCreditsFocusRefresh()
    })

    await flush()

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    await flush()

    const freshCalls = fetchMock.mock.calls.filter(([url]) => {
      return String(url) === '/api/credits?fresh=1'
    })

    expect(freshCalls).toHaveLength(1)
  })

  it('skips the focus refresh when credits are younger than 30 s', async () => {
    fetchMock.mockImplementation(() => {
      return Promise.resolve(creditsResponse(creditsAt(iso(-10_000), 1)))
    })

    renderHook(() => {
      useCredits()
    })

    renderHook(() => {
      useCreditsFocusRefresh()
    })

    await flush()

    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    await flush()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('fetches fresh when the tab becomes visible and credits are stale', async () => {
    fetchMock.mockImplementation((url: string) => {
      return Promise.resolve(
        creditsResponse(
          url.includes('fresh=1') ? creditsAt(iso(0), 2) : creditsAt(iso(-31_000), 1),
        ),
      )
    })

    renderHook(() => {
      useCredits()
    })

    renderHook(() => {
      useCreditsFocusRefresh()
    })

    await flush()

    isHidden = true

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await flush()

    expect(fetchMock).toHaveBeenCalledTimes(1)

    isHidden = false

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await flush()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/credits?fresh=1')
  })
})

describe('credits manual refresh', () => {
  it('toasts on failure, keeps the Updated text and spins while running', async () => {
    fetchMock.mockResolvedValueOnce(creditsResponse(creditsAt(iso(-65_000), 1)))

    const pending = Promise.withResolvers<Response>()

    fetchMock.mockReturnValueOnce(pending.promise)

    render(<CreditsPopover />)

    await flush()

    const updated = screen.getByText('Updated 1 min ago')
    const button = screen.getByRole('button', { name: 'Refresh' })

    await act(async () => {
      fireEvent.click(button)
      await Promise.resolve()
    })

    expect(button.getAttribute('disabled')).toBe('')
    expect(button.querySelector('svg')?.classList.contains('animate-spin')).toBe(true)

    await act(async () => {
      pending.reject(new Error('refresh failed'))
    })

    await flush()

    expect(toast.error).toHaveBeenCalledWith('refresh failed')
    expect(updated.textContent).toBe('Updated 1 min ago')
    expect(screen.getByText('Updated 1 min ago')).toBeTruthy()
    expect(button.querySelector('svg')?.classList.contains('animate-spin')).toBe(false)
  })
})
