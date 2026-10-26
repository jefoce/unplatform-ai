// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAsyncAction } from '@/lib/use-async-action'

let resolveAction: () => void = () => {}

afterEach(() => {
  cleanup()
})

describe('useAsyncAction', () => {
  it('sets the busy flag while the action runs', async () => {
    const action = vi.fn(() => {
      return new Promise<void>((resolve) => {
        resolveAction = resolve
      })
    })

    const { result } = renderHook(() => {
      return useAsyncAction(action)
    })

    act(() => {
      void result.current.run()
    })

    expect(result.current.isRunning).toBe(true)

    await act(async () => {
      resolveAction()
    })

    await waitFor(() => {
      expect(result.current.isRunning).toBe(false)
    })
  })

  it('ignores a call while one is running', async () => {
    const action = vi.fn(() => {
      return new Promise<void>((resolve) => {
        resolveAction = resolve
      })
    })

    const { result } = renderHook(() => {
      return useAsyncAction(action)
    })

    await act(async () => {
      const first = result.current.run()
      const second = result.current.run()

      resolveAction()
      await Promise.all([first, second])
    })

    expect(action).toHaveBeenCalledTimes(1)
  })

  it('runs the latest action after a rerender', async () => {
    const first = vi.fn(async () => {})
    const second = vi.fn(async () => {})

    const { result, rerender } = renderHook(
      ({ action }) => {
        return useAsyncAction(action)
      },
      {
        initialProps: { action: first },
      },
    )

    rerender({ action: second })

    await act(async () => {
      await result.current.run()
    })

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
