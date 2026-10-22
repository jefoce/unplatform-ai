// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ReferencePlan } from '@/core/types'
import { useImagePlan } from '@/features/generator/use-image-plan'
import { apiPost } from '@/lib/fetcher'

vi.mock('@/lib/fetcher', () => ({ apiPost: vi.fn() }))

function deferred<T>() {
  return Promise.withResolvers<T>()
}

function plan(step: number): ReferencePlan {
  return { step, maxSide: step > 1 ? 3072 : 4096, totalBytes: 100, images: [] }
}

const post = vi.mocked(apiPost)

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useImagePlan', () => {
  it('waits 400 ms before asking', async () => {
    const answer = deferred<ReferencePlan>()

    post.mockReturnValueOnce(answer.promise)
    const { result } = renderHook(() => useImagePlan('wan-3.0', ['a']))

    act(() => {
      vi.advanceTimersByTime(399)
    })
    expect(post).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(post).toHaveBeenCalledWith('/api/references/plan', { presetId: 'wan-3.0', ids: ['a'] })

    await act(async () => {
      answer.resolve(plan(2))
    })
    expect(result.current?.step).toBe(2)
  })

  it('drops an answer for an older list', async () => {
    const older = deferred<ReferencePlan>()
    const newer = deferred<ReferencePlan>()

    post.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    const { result, rerender } = renderHook(({ ids }) => useImagePlan('wan-3.0', ids), {
      initialProps: { ids: ['a'] },
    })

    act(() => {
      vi.advanceTimersByTime(400)
    })
    rerender({ ids: ['b'] })
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(post).toHaveBeenCalledTimes(2)

    await act(async () => {
      newer.resolve(plan(3))
    })
    expect(result.current?.step).toBe(3)

    await act(async () => {
      older.resolve(plan(1))
    })
    expect(result.current?.step).toBe(3)
  })

  it('does nothing without images', () => {
    renderHook(() => useImagePlan('wan-3.0', []))
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(post).not.toHaveBeenCalled()
  })
})
