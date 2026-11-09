// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CatalogEntry } from '@/core/catalog'
import { getPreset, setRuntimeVideoPresets } from '@/core/presets'
import type { VideoPreset } from '@/core/presets/video/types'
import type { PricingInfo } from '@/core/pricing/types'
import { ResolutionPopover } from '@/features/generator/options/ResolutionPopover'
import { useGeneratorStore } from '@/features/generator/store/store'

const mocks = vi.hoisted(() => {
  return { entry: null as CatalogEntry | null }
})

vi.mock('@/lib/api/catalog', () => {
  return {
    useModelEntry: () => {
      return mocks.entry
    },
  }
})

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const BASE = getPreset('wan-3.0')

const STATIC_PRICING: PricingInfo = {
  skus: {
    duration_seconds_480p: 0.05,
    duration_seconds_720p: 0.1,
    duration_seconds_1080p: 0.2,
  },
  listSkus: {},
  discount: 0,
  source: 'fallback',
  fetchedAt: '2026-01-01T00:00:00.000Z',
}

function customPreset(perRun: number): VideoPreset {
  return {
    ...BASE,
    id: 'custom.ep.minimax',
    title: 'MiniMax',
    family: 'custom',
    bindings: [
      {
        provider: 'custom',
        modelId: 'minimax',
        pricing: { formula: 'perRun', skuRules: [], fallback: { per_run: perRun } },
        transport: { image: 'base64', video: 'upload', audio: 'upload' },
      },
    ],
  }
}

function pricingInfo(perRun: number, source: PricingInfo['source']): PricingInfo {
  return {
    skus: { per_run: perRun },
    listSkus: {},
    discount: 0,
    source,
    fetchedAt: '2026-01-01T00:00:00.000Z',
  }
}

function catalogEntry(preset: VideoPreset, pricing: PricingInfo, isLocal: boolean): CatalogEntry {
  const kind = isLocal ? 'custom' : 'openrouter'
  const instanceId = isLocal ? 'cu1' : 'openrouter'

  return {
    modelId: preset.id,
    presetId: preset.id,
    provider: kind,
    status: 'available',
    reason: null,
    pricing,
    source: { kind, instanceId, badge: null, workflowName: null, local: isLocal },
    preset,
  }
}

function openPopover(preset: VideoPreset): HTMLElement {
  setRuntimeVideoPresets([preset])
  useGeneratorStore.setState({ presetId: preset.id })
  render(<ResolutionPopover />)
  fireEvent.click(screen.getByRole('button'))

  return screen.getByRole('dialog')
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer)

  mocks.entry = null

  useGeneratorStore.setState({
    presetId: 'wan-3.0',
    tab: 'frames',
    prompts: { frames: '', references: '' },
    audio: true,
    duration: 5,
    aspectRatio: '16:9',
    resolution: '1080p',
    frames: { start: null, end: null },
    references: [],
    uploadsById: {},
    seed: null,
  })
})

afterEach(() => {
  cleanup()
  setRuntimeVideoPresets([])
  document.body.replaceChildren()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('resolution price column', () => {
  it('hides prices and the footer for a zero-price custom model', () => {
    const preset = customPreset(0)

    mocks.entry = catalogEntry(preset, pricingInfo(0, 'fallback'), true)

    const dialog = openPopover(preset)

    expect(within(dialog).queryByText('--')).toBeNull()
    expect(within(dialog).queryByText(/Saved rates/)).toBeNull()
  })

  it('shows prices and the footer when the custom per-run price is set', () => {
    const preset = customPreset(0)

    mocks.entry = catalogEntry(preset, pricingInfo(2.5, 'fallback'), true)

    const dialog = openPopover(preset)

    expect(within(dialog).getAllByText('--').length).toBeGreaterThan(0)
    expect(within(dialog).getByText(/Saved rates/)).not.toBeNull()
  })

  it('shows rates and the fallback footer for an API model', () => {
    mocks.entry = catalogEntry(BASE, STATIC_PRICING, false)

    const dialog = openPopover(BASE)

    expect(within(dialog).queryByText('--')).toBeNull()
    expect(within(dialog).getByText('$0.20/s')).not.toBeNull()
    expect(within(dialog).getByText(/Saved rates/)).not.toBeNull()
  })
})
