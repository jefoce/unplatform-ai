// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useBoolean } from '@/lib/use-boolean'

afterEach(() => {
  cleanup()
})

describe('useBoolean', () => {
  it('starts off by default', () => {
    const { result } = renderHook(() => {
      return useBoolean()
    })

    expect(result.current.value).toBe(false)
  })

  it('turns on and off', () => {
    const { result } = renderHook(() => {
      return useBoolean()
    })

    act(() => {
      result.current.on()
    })

    expect(result.current.value).toBe(true)

    act(() => {
      result.current.off()
    })

    expect(result.current.value).toBe(false)
  })

  it('toggles from either value', () => {
    const { result } = renderHook(() => {
      return useBoolean()
    })

    act(() => {
      result.current.toggle()
    })

    expect(result.current.value).toBe(true)

    act(() => {
      result.current.toggle()
    })

    expect(result.current.value).toBe(false)
  })

  it('sets an explicit value', () => {
    const { result } = renderHook(() => {
      return useBoolean(true)
    })

    expect(result.current.value).toBe(true)

    act(() => {
      result.current.set(false)
    })

    expect(result.current.value).toBe(false)

    act(() => {
      result.current.set(true)
    })

    expect(result.current.value).toBe(true)
  })
})
