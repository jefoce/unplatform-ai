/* eslint-disable react/no-multi-comp -- two estimate components share one cache test */

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { mutate as globalMutate, useSWRConfig } from 'swr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenerationEstimate } from '@/core/api/video'
import { usePanelPrice } from '@/features/generator/generate/use-panel-price'
import { useGeneratorStore } from '@/features/generator/store/store'
import { useImageGeneratorStore } from '@/features/image-generator/store'
import { useImageEstimate } from '@/features/image-generator/use-image-estimate'
import type * as Generations from '@/lib/api/generations'
import type * as Images from '@/lib/api/images'
import { isEstimateKey } from '@/lib/api/swr-keys'

const mocks = vi.hoisted(() => {
  return {
    fetchEstimate: vi.fn(),
    fetchImageEstimate: vi.fn(),
  }
})

vi.mock('@/lib/api/generations', async (importOriginal) => {
  const actual = await importOriginal<typeof Generations>()

  return { ...actual, fetchEstimate: mocks.fetchEstimate }
})

vi.mock('@/lib/api/images', async (importOriginal) => {
  const actual = await importOriginal<typeof Images>()

  return { ...actual, fetchImageEstimate: mocks.fetchImageEstimate }
})

function VideoPrice() {
  const price = usePanelPrice(true)

  return <div data-testid="video-price">{price.price ?? 'none'}</div>
}

function ImagePrice() {
  const estimate = useImageEstimate(true)

  return <div data-testid="image-price">{estimate.usd ?? 'none'}</div>
}

function RefreshButton() {
  const { mutate } = useSWRConfig()

  const handleRefresh = () => {
    void mutate(isEstimateKey)
  }

  return (
    <button type="button" onClick={handleRefresh}>
      Refresh
    </button>
  )
}

async function waitForText(testId: string, text: string): Promise<void> {
  await waitFor(
    () => {
      expect(screen.getByTestId(testId).textContent).toBe(text)
    },
    { timeout: 2000 },
  )
}

beforeEach(async () => {
  mocks.fetchEstimate.mockReset()
  mocks.fetchImageEstimate.mockReset()

  await globalMutate(
    () => {
      return true
    },
    undefined,
    { revalidate: false },
  )

  useGeneratorStore.setState({
    presetId: 'wan-3.0',
    resolution: '480p',
    aspectRatio: '16:9',
    audio: true,
    tab: 'frames',
    references: [],
  })

  useImageGeneratorStore.setState({
    presetId: 'flux-2',
    count: 1,
    prompt: '',
    aspectRatio: '1:1',
    resolution: null,
    quality: null,
    background: null,
    references: [],
    seed: null,
  })
})

afterEach(cleanup)

describe('estimate refresh after a settings save', () => {
  it('refreshes a failed video price without a remount', async () => {
    const estimate: GenerationEstimate = {
      estimatedUsd: 0.51,
      listUsd: 0.6,
      pricePerSec: 0.1,
      priceSource: 'live',
      discount: 0,
      referenceSeconds: 0,
    }

    mocks.fetchEstimate.mockRejectedValueOnce(new Error('no key'))
    mocks.fetchEstimate.mockResolvedValueOnce(estimate)

    render(
      <>
        <VideoPrice />
        <RefreshButton />
      </>,
    )

    await waitFor(() => {
      expect(mocks.fetchEstimate).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByTestId('video-price').textContent).toBe('none')

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitForText('video-price', '0.51')

    expect(mocks.fetchEstimate).toHaveBeenCalledTimes(2)
  })

  it('refreshes a failed image price without a remount', async () => {
    mocks.fetchImageEstimate.mockRejectedValueOnce(new Error('no key'))
    mocks.fetchImageEstimate.mockResolvedValueOnce({ usd: 0.04, isApproximate: false })

    render(
      <>
        <ImagePrice />
        <RefreshButton />
      </>,
    )

    await waitFor(() => {
      expect(mocks.fetchImageEstimate).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByTestId('image-price').textContent).toBe('none')

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitForText('image-price', '0.04')

    expect(mocks.fetchImageEstimate).toHaveBeenCalledTimes(2)
  })
})
