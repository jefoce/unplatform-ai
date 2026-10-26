// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDebouncedValue } from '@/lib/use-debounced-value'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function renderDebounced(initial: string) {
  return renderHook(
    (props: { value: string }) => {
      return useDebouncedValue(props.value, 100)
    },
    {
      initialProps: { value: initial },
    },
  )
}

describe('useDebouncedValue', () => {
  it('starts at the current value', () => {
    const { result } = renderDebounced('a')

    expect(result.current).toBe('a')
  })

  it('settles after the delay', () => {
    const { result, rerender } = renderDebounced('a')

    rerender({ value: 'b' })

    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current).toBe('b')
  })

  it('restarts the timer on every change', () => {
    const { result, rerender } = renderDebounced('a')

    rerender({ value: 'b' })

    act(() => {
      vi.advanceTimersByTime(50)
    })

    rerender({ value: 'c' })

    act(() => {
      vi.advanceTimersByTime(50)
    })

    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(50)
    })

    expect(result.current).toBe('c')
  })
})
