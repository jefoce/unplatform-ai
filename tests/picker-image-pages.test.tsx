// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as ImagesModule from '@/lib/api/images'
import { useImagePages } from '@/lib/use-image-pages'

import type { ImageListResult } from '../src/core/api/image'
import type { ImageRecord } from '../src/core/schemas/image-record'

const mocks = vi.hoisted(() => {
  return { fetchImagePage: vi.fn() }
})

vi.mock('@/lib/api/images', async (importOriginal) => {
  const actual = await importOriginal<typeof ImagesModule>()

  return { ...actual, fetchImagePage: mocks.fetchImagePage }
})

function imageRecord(id: string, createdAt: string): ImageRecord {
  return {
    id,
    createdAt,
    updatedAt: createdAt,
    status: 'completed',
    provider: 'openrouter',
    preset: { id: 'fixture', title: 'Fixture', slug: 'fixture' },
    input: {
      presetId: 'fixture',
      prompt: 'a cat',
      count: 1,
      aspectRatio: '1:1',
      resolution: '1K',
      quality: null,
      background: null,
      references: [],
      seed: null,
    },
    outputs: [],
    seedUsed: null,
    cost: {
      currency: 'USD',
      unit: 'image',
      estimatedUsd: 0,
      actualUsd: null,
      priceSource: 'mock',
      billed: null,
    },
  }
}

function SwrWrapper(props: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        provider: () => {
          return new Map()
        },
      }}
    >
      {props.children}
    </SWRConfig>
  )
}

beforeEach(() => {
  mocks.fetchImagePage.mockReset()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function page(items: ImageRecord[], nextCursor: string | null): ImageListResult {
  return { items, nextCursor, activeCount: 0 }
}

describe('picker image pages', () => {
  it('follows the cursor until the next page is empty', async () => {
    const first = page([imageRecord('a', '2026-01-02T00:00:00.000Z')], '2026-01-02T00:00:00.000Z|a')
    const second = page([imageRecord('b', '2026-01-01T00:00:00.000Z')], null)

    mocks.fetchImagePage.mockImplementation((key: string) => {
      if (key.includes('cursor=')) {
        return Promise.resolve(second)
      }

      return Promise.resolve(first)
    })

    const { result } = renderHook(
      () => {
        return useImagePages({ filters: { favorite: true } })
      },
      { wrapper: SwrWrapper },
    )

    await waitFor(() => {
      expect(result.current.records).toHaveLength(1)
    })

    expect(result.current.hasMore).toBe(true)

    act(() => {
      result.current.loadMore()
    })

    await waitFor(() => {
      expect(result.current.records).toHaveLength(2)
    })

    expect(result.current.hasMore).toBe(false)

    const cursors = mocks.fetchImagePage.mock.calls.filter(([key]) => {
      return String(key).includes('cursor=')
    })

    expect(cursors).toHaveLength(1)
  })

  it('polls page 1 only and keeps the loaded pages', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    const first = page([imageRecord('a', '2026-01-02T00:00:00.000Z')], '2026-01-02T00:00:00.000Z|a')
    const second = page([imageRecord('b', '2026-01-01T00:00:00.000Z')], null)

    mocks.fetchImagePage.mockImplementation((key: string) => {
      if (key.includes('cursor=')) {
        return Promise.resolve(second)
      }

      return Promise.resolve(first)
    })

    const { result } = renderHook(
      () => {
        return useImagePages({ filters: {}, refreshInterval: 1000 })
      },
      { wrapper: SwrWrapper },
    )

    await waitFor(() => {
      expect(result.current.records).toHaveLength(1)
    })

    act(() => {
      result.current.loadMore()
    })

    await waitFor(() => {
      expect(result.current.records).toHaveLength(2)
    })

    mocks.fetchImagePage.mockClear()

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    expect(mocks.fetchImagePage).toHaveBeenCalledTimes(1)

    const [key] = mocks.fetchImagePage.mock.calls[0] ?? []

    expect(String(key)).not.toContain('cursor=')
    expect(result.current.records).toHaveLength(2)
  })
})
