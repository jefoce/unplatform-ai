// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GeneratorPanel } from '@/features/generator/panel/GeneratorPanel'
import { useGeneratorStore } from '@/features/generator/store/store'

const KEY_REASON = 'Add your OpenRouter key in Settings.'

vi.mock('@/features/generator/use-provider-ready', () => {
  return {
    useProviderReady: () => {
      return { isKeyMissing: true, isReady: false, reason: KEY_REASON }
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

vi.mock('@/features/generator/panel/PanelHeader', () => {
  return {
    PanelHeader: () => {
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

vi.mock('@/features/generator/panel/PanelPrompt', () => {
  return {
    PanelPrompt: () => {
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

const ESTIMATE = {
  estimatedUsd: 0.5,
  listUsd: 0.5,
  pricePerSec: 0.1,
  priceSource: 'mock',
  discount: 0,
  referenceSeconds: 0,
}

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input) === '/api/generations/estimate' && init?.method === 'POST') {
    return Promise.resolve(new Response(JSON.stringify(ESTIMATE), { status: 200 }))
  }

  return new Promise<Response>(() => {})
})

function createCache() {
  return new Map()
}

function SwrWrapper(props: { children: ReactNode }) {
  return <SWRConfig value={{ provider: createCache }}>{props.children}</SWRConfig>
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockClear()

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
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('video submit without a provider key', () => {
  it('disables Generate and shows the key reason', async () => {
    render(
      <SwrWrapper>
        <GeneratorPanel />
      </SwrWrapper>,
    )

    const button = screen.getByRole<HTMLButtonElement>('button', { name: /Generate/ })

    expect(button.disabled).toBe(true)

    fireEvent.focus(button)

    expect((await screen.findByRole('tooltip')).textContent).toBe(KEY_REASON)
  })
})
