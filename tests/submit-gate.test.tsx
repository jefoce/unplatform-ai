// @vitest-environment jsdom
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { type Cache, SWRConfig } from 'swr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type SubmitGateParams, useSubmitGate } from '@/features/generator/generate/use-submit-gate'
import { ImagePromptBar } from '@/features/image-generator/ImagePromptBar'
import { useImageGeneratorStore } from '@/features/image-generator/store'

vi.hoisted(() => {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: () => {
        return { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
      },
    })
  }
})

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

type EstimateMode = 'pending' | 'reject'

let estimateMode: EstimateMode = 'pending'

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = String(input)

  if (url === '/api/images/estimate') {
    if (estimateMode === 'reject') {
      return Promise.resolve(
        new Response(JSON.stringify({ error: 'Estimate failed' }), { status: 500 }),
      )
    }

    return new Promise<Response>(() => {})
  }

  if (url === '/api/images' && init?.method === 'POST') {
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
  }

  return new Promise<Response>(() => {})
})

function createPostCount(): number {
  return fetchMock.mock.calls.filter(([input, init]) => {
    return String(input) === '/api/images' && init?.method === 'POST'
  }).length
}

function estimateCallCount(): number {
  return fetchMock.mock.calls.filter(([input]) => {
    return String(input) === '/api/images/estimate'
  }).length
}

function createCache(): Cache {
  return new Map()
}

function SwrWrapper(props: { children: ReactNode }) {
  return <SWRConfig value={{ provider: createCache }}>{props.children}</SWRConfig>
}

const CLEAR_GATE: SubmitGateParams = {
  isValid: true,
  isReady: true,
  isAtLimit: false,
  isPriceLoading: false,
  price: 0.02,
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer)

  Range.prototype.getBoundingClientRect = () => {
    return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 } as DOMRect
  }

  Range.prototype.getClientRects = () => {
    return {
      length: 0,
      item: () => {
        return null
      },
    } as unknown as DOMRectList
  }

  vi.stubGlobal('matchMedia', () => {
    return { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  })

  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockClear()
  estimateMode = 'pending'

  useImageGeneratorStore.setState({
    prompt: 'a cat',
    references: [],
    uploadsById: {},
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useSubmitGate', () => {
  it('blocks while the price is loading', () => {
    const { result } = renderHook(() => {
      return useSubmitGate({ ...CLEAR_GATE, isPriceLoading: true, price: null })
    })

    expect(result.current).toEqual({ canSubmit: false, reason: 'Getting price' })
  })

  it('blocks when the settled price is missing', () => {
    const { result } = renderHook(() => {
      return useSubmitGate({ ...CLEAR_GATE, price: null })
    })

    expect(result.current).toEqual({ canSubmit: false, reason: 'Price unavailable' })
  })

  it('blocks an invalid draft without a reason', () => {
    const { result } = renderHook(() => {
      return useSubmitGate({ ...CLEAR_GATE, isValid: false })
    })

    expect(result.current).toEqual({ canSubmit: false, reason: null })
  })

  it('blocks at the active limit with the limit message', () => {
    const { result } = renderHook(() => {
      return useSubmitGate({
        ...CLEAR_GATE,
        isAtLimit: true,
        limitMessage: '3 images already generating. Wait for one to finish.',
      })
    })

    expect(result.current).toEqual({
      canSubmit: false,
      reason: '3 images already generating. Wait for one to finish.',
    })
  })

  it('allows the submit when every check passes', () => {
    const { result } = renderHook(() => {
      return useSubmitGate(CLEAR_GATE)
    })

    expect(result.current).toEqual({ canSubmit: true, reason: null })
  })
})

describe('ImagePromptBar keyboard submit', () => {
  it('does not create an image while the price is pending', async () => {
    render(<ImagePromptBar activeCount={0} />, { wrapper: SwrWrapper })

    const editor = screen.getByRole('textbox', { name: 'Prompt' })

    await waitFor(() => {
      expect(estimateCallCount()).toBeGreaterThan(0)
    })

    fireEvent.keyDown(editor, { key: 'Enter', metaKey: true })
    fireEvent.keyDown(editor, { key: 'Enter', ctrlKey: true })

    expect(createPostCount()).toBe(0)
  })

  it('does not create an image and shows the reason when the estimate fails', async () => {
    estimateMode = 'reject'

    render(<ImagePromptBar activeCount={0} />, { wrapper: SwrWrapper })

    const editor = screen.getByRole('textbox', { name: 'Prompt' })

    await waitFor(() => {
      expect(screen.getAllByText('Price unavailable').length).toBeGreaterThan(0)
    })

    fireEvent.keyDown(editor, { key: 'Enter', metaKey: true })
    fireEvent.keyDown(editor, { key: 'Enter', ctrlKey: true })

    expect(createPostCount()).toBe(0)
  })
})
