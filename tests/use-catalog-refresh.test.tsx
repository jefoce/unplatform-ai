// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCatalogRefresh } from '@/features/generator/model/use-catalog-refresh'

const mocks = vi.hoisted(() => {
  return { refreshCatalog: vi.fn(), toastError: vi.fn() }
})

vi.mock('@/lib/api/catalog', () => {
  return { refreshCatalog: mocks.refreshCatalog }
})

vi.mock('@/lib/notify', () => {
  return { toastError: mocks.toastError }
})

beforeEach(() => {
  mocks.refreshCatalog.mockReset()
  mocks.toastError.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('useCatalogRefresh', () => {
  it('passes the force option to a manual refresh', async () => {
    mocks.refreshCatalog.mockResolvedValue(undefined)

    const { result } = renderHook(() => {
      return useCatalogRefresh()
    })

    await act(async () => {
      result.current.refresh()
      await Promise.resolve()
    })

    expect(mocks.refreshCatalog).toHaveBeenLastCalledWith({ isForce: false })

    await act(async () => {
      result.current.forceRefresh()
      await Promise.resolve()
    })

    expect(mocks.refreshCatalog).toHaveBeenLastCalledWith({ isForce: true })
  })

  it('toasts a rejected refresh and still clears the spinner', async () => {
    const error = new Error('offline')
    let failRefresh: ((reason: unknown) => void) | undefined

    mocks.refreshCatalog.mockReturnValue(
      new Promise<void>((_resolve, reject) => {
        failRefresh = reject
      }),
    )

    const { result } = renderHook(() => {
      return useCatalogRefresh()
    })

    act(() => {
      result.current.refresh()
    })

    expect(result.current.isFetching).toBe(true)

    await act(async () => {
      failRefresh?.(error)
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false)
    })

    expect(mocks.toastError).toHaveBeenCalledWith(error, 'Could not refresh models')
  })
})
