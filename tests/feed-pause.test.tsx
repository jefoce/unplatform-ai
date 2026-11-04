// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenerationListResult } from '@/core/api/video'
import { useHistory } from '@/features/history/list/use-history'
import { setWorkspaceTab } from '@/features/shared/use-workspace-tab'
import { useImageWorkspaceItems } from '@/features/workspace/use-image-workspace-items'
import type * as GenerationsModule from '@/lib/api/generations'
import type * as ImagesModule from '@/lib/api/images'

const mocks = vi.hoisted(() => {
  return { fetchGenerationPage: vi.fn(), fetchImagePage: vi.fn() }
})

vi.mock('@/lib/api/generations', async (importOriginal) => {
  const actual = await importOriginal<typeof GenerationsModule>()

  return { ...actual, fetchGenerationPage: mocks.fetchGenerationPage }
})

vi.mock('@/lib/api/images', async (importOriginal) => {
  const actual = await importOriginal<typeof ImagesModule>()

  return { ...actual, fetchImagePage: mocks.fetchImagePage }
})

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

const EMPTY_GENERATIONS: GenerationListResult = { items: [], nextCursor: null, activeCount: 0 }

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  mocks.fetchGenerationPage.mockReset()
  mocks.fetchImagePage.mockReset()
  mocks.fetchGenerationPage.mockResolvedValue(EMPTY_GENERATIONS)
  mocks.fetchImagePage.mockResolvedValue({ items: [], nextCursor: null, activeCount: 0 })
})

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

describe('workspace feeds on both tabs', () => {
  it('pauses the image feed on the video tab', async () => {
    renderHook(
      () => {
        return useImageWorkspaceItems()
      },
      { wrapper: SwrWrapper },
    )

    await act(async () => {})

    expect(mocks.fetchImagePage).not.toHaveBeenCalled()

    act(() => {
      setWorkspaceTab('image')
    })

    await waitFor(() => {
      expect(mocks.fetchImagePage).toHaveBeenCalledTimes(1)
    })
  })

  it('keeps polling history on the image tab', async () => {
    window.history.replaceState(null, '', '/?tab=image')

    renderHook(
      () => {
        return useHistory()
      },
      { wrapper: SwrWrapper },
    )

    await waitFor(() => {
      expect(mocks.fetchGenerationPage).toHaveBeenCalledTimes(1)
    })

    act(() => {
      setWorkspaceTab('video')
    })

    await act(async () => {})

    expect(mocks.fetchGenerationPage).toHaveBeenCalledTimes(1)
  })
})
