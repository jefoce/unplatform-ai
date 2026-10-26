// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenerationEstimate } from '@/core/types'
import { usePanelPrice } from '@/features/generator/generate/use-panel-price'

const mocks = vi.hoisted(() => {
  return {
    fetchEstimate: vi.fn(),
  }
})

vi.mock('@/lib/api/generations', () => {
  return {
    fetchEstimate: mocks.fetchEstimate,
  }
})

const estimate: GenerationEstimate = {
  estimatedUsd: 1.5,
  listUsd: 2,
  pricePerSec: 0.1,
  priceSource: 'mock',
  discount: 0.25,
}

const createCache = () => {
  return new Map()
}

function SwrWrapper(props: { children: ReactNode }) {
  return <SWRConfig value={{ provider: createCache }}>{props.children}</SWRConfig>
}

function renderPrice(isEnabled: boolean) {
  return renderHook(
    (props: { isEnabled: boolean }) => {
      return usePanelPrice(props.isEnabled)
    },
    {
      wrapper: SwrWrapper,
      initialProps: { isEnabled },
    },
  )
}

async function settle(ms: number): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  })
}

beforeEach(() => {
  mocks.fetchEstimate.mockReset()
  mocks.fetchEstimate.mockResolvedValue(estimate)
})

afterEach(cleanup)

describe('usePanelPrice', () => {
  it('sends no estimate request and never loads while disabled', async () => {
    const { result } = renderPrice(false)

    await settle(700)

    expect(mocks.fetchEstimate).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
  })

  it('sends one estimate request when enabled', async () => {
    const { result } = renderPrice(true)

    await waitFor(() => {
      expect(mocks.fetchEstimate).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(result.current.price).toBe(1.5)
    })

    expect(result.current.isLoading).toBe(false)
  })

  it('sends one estimate request in total when enabled after a disabled draft', async () => {
    const { result, rerender } = renderPrice(false)

    await settle(700)

    expect(mocks.fetchEstimate).not.toHaveBeenCalled()

    rerender({ isEnabled: true })

    await waitFor(() => {
      expect(mocks.fetchEstimate).toHaveBeenCalledTimes(1)
    })

    await settle(700)

    expect(mocks.fetchEstimate).toHaveBeenCalledTimes(1)
    expect(result.current.price).toBe(1.5)
  })
})
