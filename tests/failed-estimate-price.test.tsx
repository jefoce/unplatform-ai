/* eslint-disable max-lines -- both generator surfaces keep their failure case together */

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GeneratorPanel } from '@/features/generator/panel/GeneratorPanel'
import { useGeneratorStore } from '@/features/generator/store/store'
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

vi.mock('@/features/generator/use-provider-ready', () => {
  return {
    useProviderReady: () => {
      return { isKeyMissing: false, isReady: true, reason: null }
    },
  }
})

vi.mock('@/lib/api/catalog', () => {
  return {
    useModelEntry: () => {
      return null
    },
  }
})

vi.mock('@/lib/api/remote', () => {
  return {
    useRemoteStatus: () => {
      return true
    },
  }
})

vi.mock('@/features/settings/use-secrets', () => {
  return {
    useSecrets: () => {
      return { status: null, isLoading: false, refresh: vi.fn() }
    },
  }
})

vi.mock('@/lib/use-uploads-refresh', () => {
  return { useUploadsRefresh: () => {} }
})

vi.mock('@/features/image-generator/use-image-uploads-refresh', () => {
  return { useImageUploadsRefresh: () => {} }
})

vi.mock('@/features/generator/credits/CreditsBadge', () => {
  return {
    CreditsBadge: () => {
      return null
    },
  }
})

vi.mock('@/features/generator/panel/ModeTabs', () => {
  return {
    ModeTabs: () => {
      return null
    },
  }
})

vi.mock('@/features/generator/panel/SettingsRow', () => {
  return {
    SettingsRow: () => {
      return null
    },
  }
})

vi.mock('@/features/generator/model/ModelPicker', () => {
  return {
    ModelPicker: () => {
      return null
    },
  }
})

vi.mock('@/features/generator/frames/FrameSlots', () => {
  return {
    FrameSlots: () => {
      return null
    },
  }
})

vi.mock('@/features/generator/references/ReferencesBox', () => {
  return {
    ReferencesBox: () => {
      return null
    },
  }
})

vi.mock('@/features/image-generator/ImageReferences', () => {
  return {
    ImageReferences: () => {
      return null
    },
  }
})

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

interface FetchState {
  estimateCalls: number
}

const state: FetchState = { estimateCalls: 0 }

const VIDEO_ESTIMATE = {
  estimatedUsd: 0.5,
  listUsd: 0.5,
  pricePerSec: 0.1,
  priceSource: 'mock',
  discount: 0,
  referenceSeconds: 0,
}

const IMAGE_ESTIMATE = { perImageUsd: 0.02, usd: 0.02, unit: 'image', isApproximate: true }

const ESTIMATE_BODIES: Record<string, unknown> = {
  '/api/generations/estimate': VIDEO_ESTIMATE,
  '/api/images/estimate': IMAGE_ESTIMATE,
}

const CREATE_PATHS = ['/api/generations', '/api/images']

/** First estimate for a key succeeds, every later one fails like a 500. */
function estimateResponse(body: unknown): Promise<Response> {
  state.estimateCalls += 1

  if (state.estimateCalls === 1) {
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
  }

  return Promise.resolve(
    new Response(JSON.stringify({ error: 'Estimate failed' }), { status: 500 }),
  )
}

function responseFor(url: string, init?: RequestInit): Promise<Response> | null {
  if (init?.method !== 'POST') {
    return null
  }

  if (CREATE_PATHS.includes(url)) {
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
  }

  if (!Object.hasOwn(ESTIMATE_BODIES, url)) {
    return null
  }

  return estimateResponse(ESTIMATE_BODIES[url])
}

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const handled = responseFor(String(input), init)

  if (handled) {
    return handled
  }

  return new Promise<Response>(() => {})
})

function createPostCount(path: string): number {
  return fetchMock.mock.calls.filter(([input, init]) => {
    return String(input) === path && init?.method === 'POST'
  }).length
}

function createCache() {
  return new Map()
}

function SwrWrapper(props: { children: ReactNode }) {
  return <SWRConfig value={{ provider: createCache }}>{props.children}</SWRConfig>
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
  state.estimateCalls = 0

  useGeneratorStore.setState({
    presetId: 'wan-3.0',
    tab: 'frames',
    prompts: { frames: 'a cat', references: '' },
    duration: 5,
    resolution: '1080p',
    aspectRatio: '16:9',
    frames: { start: null, end: null },
    references: [],
  })

  useImageGeneratorStore.setState({
    prompt: 'a cat',
    count: 1,
    references: [],
    uploadsById: {},
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('video panel after a failed estimate', () => {
  it('drops the shown price, disables Generate and blocks the keyboard submit', async () => {
    render(
      <SwrWrapper>
        <GeneratorPanel />
      </SwrWrapper>,
    )

    const button = screen.getByRole<HTMLButtonElement>('button', { name: /Generate/ })

    await waitFor(
      () => {
        expect(within(button).getByText('$0.50')).toBeTruthy()
      },
      { timeout: 3000 },
    )

    expect(button.disabled).toBe(false)

    act(() => {
      useGeneratorStore.setState({ duration: 10 })
    })

    await waitFor(
      () => {
        expect(screen.getAllByText('Price unavailable').length).toBeGreaterThan(0)
      },
      { timeout: 3000 },
    )

    expect(button.disabled).toBe(true)
    expect(within(button).queryByText('$0.50')).toBeNull()

    const editor = screen.getByRole('textbox', { name: 'Prompt' })

    fireEvent.keyDown(editor, { key: 'Enter', metaKey: true })

    expect(createPostCount('/api/generations')).toBe(0)
  })
})

describe('image bar after a failed estimate', () => {
  it('drops the shown price, disables Generate and blocks the keyboard submit', async () => {
    render(
      <SwrWrapper>
        <ImagePromptBar activeCount={0} />
      </SwrWrapper>,
    )

    const button = screen.getByRole<HTMLButtonElement>('button', { name: /Generate/ })

    await waitFor(
      () => {
        expect(within(button).getByText('~$0.02')).toBeTruthy()
      },
      { timeout: 3000 },
    )

    expect(button.disabled).toBe(false)

    act(() => {
      useImageGeneratorStore.setState({ count: 2 })
    })

    await waitFor(
      () => {
        expect(screen.getAllByText('Price unavailable').length).toBeGreaterThan(0)
      },
      { timeout: 3000 },
    )

    expect(button.disabled).toBe(true)
    expect(within(button).queryByText('~$0.02')).toBeNull()

    const editor = screen.getByRole('textbox', { name: 'Prompt' })

    fireEvent.keyDown(editor, { key: 'Enter', metaKey: true })

    expect(createPostCount('/api/images')).toBe(0)
  })
})
