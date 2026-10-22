// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useNow } from '@/lib/use-now'

let isHidden = false

function setHidden(isValue: boolean): void {
  isHidden = isValue
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  isHidden = false
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => isHidden })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useNow', () => {
  it('shares one interval between subscribers', () => {
    const interval = vi.spyOn(globalThis, 'setInterval')
    const first = renderHook(() => useNow(true))
    const second = renderHook(() => useNow(true))
    const start = first.result.current

    expect(interval).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(first.result.current).toBe(start + 1000)
    expect(second.result.current).toBe(first.result.current)
  })

  it('does not subscribe while inactive', () => {
    const interval = vi.spyOn(globalThis, 'setInterval')
    const { result } = renderHook(() => useNow(false))
    const start = result.current

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(interval).not.toHaveBeenCalled()
    expect(result.current).toBe(start)
  })

  it('stops the interval after the last subscriber leaves', () => {
    const interval = vi.spyOn(globalThis, 'setInterval')
    const clear = vi.spyOn(globalThis, 'clearInterval')
    const first = renderHook(() => useNow(true))
    const second = renderHook(() => useNow(true))

    expect(interval).toHaveBeenCalledTimes(1)

    first.unmount()
    expect(clear).not.toHaveBeenCalled()

    second.unmount()
    expect(clear).toHaveBeenCalledTimes(1)
  })

  it('pauses while the page is hidden and refreshes when visible', () => {
    const { result } = renderHook(() => useNow(true))
    const start = result.current

    setHidden(true)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current).toBe(start)

    setHidden(false)
    expect(result.current).toBe(start + 3000)
  })
})
