// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useImageGeneratorStore } from '@/features/image-generator/store'
import { useImageSubmit } from '@/features/image-generator/use-image-submit'

const noopResolve = () => {}

const mocks = vi.hoisted(() => {
  return {
    createImage: vi.fn(() => {
      return Promise.resolve({})
    }),
    refreshImages: vi.fn(() => {
      return Promise.resolve()
    }),
  }
})

vi.mock('@/lib/api/images', () => {
  return { createImage: mocks.createImage }
})

vi.mock('@/lib/image-feed-refresh', () => {
  return { refreshImages: mocks.refreshImages }
})

vi.mock('@/lib/api/credits', () => {
  return {
    refreshCredits: () => {
      return Promise.resolve()
    },
  }
})

vi.mock('sonner', () => {
  return { toast: { success: vi.fn(), error: vi.fn() } }
})

afterEach(() => {
  cleanup()
  mocks.createImage.mockClear()
  mocks.refreshImages.mockClear()
})

describe('useImageSubmit', () => {
  it('keeps the prompt and references after the server accepts the record', async () => {
    let resolveCreate = noopResolve

    mocks.createImage.mockImplementationOnce(() => {
      return new Promise((resolve) => {
        resolveCreate = () => {
          resolve({})
        }
      })
    })

    useImageGeneratorStore.setState({ prompt: 'a cat', references: ['ref-1'], uploadsById: {} })

    const { result } = renderHook(() => {
      return useImageSubmit({ canSubmit: true })
    })

    act(() => {
      void result.current.submit()
    })

    expect(useImageGeneratorStore.getState().prompt).toBe('a cat')
    expect(useImageGeneratorStore.getState().references).toEqual(['ref-1'])

    await act(async () => {
      resolveCreate()
    })

    expect(useImageGeneratorStore.getState().prompt).toBe('a cat')
    expect(useImageGeneratorStore.getState().references).toEqual(['ref-1'])
  })

  it('keeps the prompt when the server rejects the record', async () => {
    mocks.createImage.mockImplementationOnce(() => {
      return Promise.reject(new Error('Rejected'))
    })

    useImageGeneratorStore.setState({ prompt: 'a cat' })

    const { result } = renderHook(() => {
      return useImageSubmit({ canSubmit: true })
    })

    await act(async () => {
      await result.current.submit()
    })

    expect(useImageGeneratorStore.getState().prompt).toBe('a cat')
  })

  it('refreshes every image key after a successful submit', async () => {
    useImageGeneratorStore.setState({ prompt: 'a cat' })

    const { result } = renderHook(() => {
      return useImageSubmit({ canSubmit: true })
    })

    await act(async () => {
      await result.current.submit()
    })

    await waitFor(() => {
      expect(mocks.refreshImages).toHaveBeenCalledTimes(1)
    })
  })
})
