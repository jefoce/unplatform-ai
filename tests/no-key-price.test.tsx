/* eslint-disable max-lines -- cases stay in one suite */
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenerationEstimate } from '@/core/api/video'
import type { PricingInfo } from '@/core/pricing/types'
import { ModelRow } from '@/features/generator/model/ModelRow'
import { videoPickerModel } from '@/features/generator/model/video-picker-model'
import { GeneratorPanel } from '@/features/generator/panel/GeneratorPanel'
import { useGeneratorStore } from '@/features/generator/store/store'
import { pickerAnchor } from '@/features/media-picker/picker/anchors'
import { useModelEntry } from '@/lib/api/models'

import type { CatalogEntry } from '../src/core/catalog'
import { getPreset } from '../src/core/presets'
import { required } from './helpers/required'

interface DraftProviderState {
  isKeyMissing: boolean
  isReady: boolean
  reason: string | null
}

const mocks = vi.hoisted(() => {
  const provider: DraftProviderState = {
    isKeyMissing: true,
    isReady: false,
    reason: 'Add your OpenRouter key in Settings.',
  }

  return {
    fetchEstimate: vi.fn(),
    useModelEntry: vi.fn(),
    draft: {
      validation: { ok: false, errors: ['Prompt is required'], warnings: [] },
      settingsValidation: { ok: false, errors: ['Prompt is required'], warnings: [] },
      isKeyMissing: true,
      isSecretsFailed: false,
      provider,
    },
  }
})

vi.mock('@/lib/api/models', () => {
  return { useModelEntry: mocks.useModelEntry }
})

vi.mock('@/lib/api/generations', () => {
  return { fetchEstimate: mocks.fetchEstimate }
})

vi.mock('@/features/generator/panel/use-panel-draft', () => {
  return {
    usePanelDraft: () => {
      return mocks.draft
    },
  }
})

vi.mock('@/lib/use-uploads-refresh', () => {
  return {
    useUploadsRefresh: () => {},
  }
})

vi.mock('@/features/generator/generate/use-generate', () => {
  return {
    useGenerate: () => {
      return { generate: vi.fn(), isGenerating: false }
    },
  }
})

vi.mock('@/features/generator/prompt/PromptField', () => {
  return {
    PromptField: () => {
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

vi.mock('@/features/generator/credits/CreditsBadge', () => {
  return {
    CreditsBadge: () => {
      return null
    },
  }
})

const mockUseModelEntry = vi.mocked(useModelEntry)
const WAN = getPreset('wan-3.0')

const PRICING: PricingInfo = {
  skus: {
    duration_seconds_480p: 0.0425,
    duration_seconds_720p: 0.085,
    duration_seconds_1080p: 0.17,
  },
  listSkus: {
    duration_seconds_480p: 0.05,
    duration_seconds_720p: 0.1,
    duration_seconds_1080p: 0.2,
  },
  discount: 0.15,
  source: 'live',
  fetchedAt: '2026-10-26T00:00:00.000Z',
}

const createCache = () => {
  return new Map()
}

function SwrWrapper(props: { children: ReactNode }) {
  return <SWRConfig value={{ provider: createCache }}>{props.children}</SWRConfig>
}

async function settle(ms: number): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  })
}

function catalogEntry(status: 'missing' | 'no_provider'): CatalogEntry {
  return {
    modelId: 'alibaba/wan-3.0',
    presetId: 'wan-3.0',
    provider: 'openrouter',
    status,
    reason: 'Add your OpenRouter key in Settings.',
    pricing: PRICING,
  }
}

beforeEach(() => {
  mockUseModelEntry.mockReset()
  mocks.fetchEstimate.mockReset()
  mocks.draft.validation = { ok: false, errors: ['Prompt is required'], warnings: [] }
  mocks.draft.settingsValidation = { ok: false, errors: ['Prompt is required'], warnings: [] }
  mocks.draft.isKeyMissing = true
  mocks.draft.isSecretsFailed = false

  mocks.draft.provider = {
    isKeyMissing: true,
    isReady: false,
    reason: 'Add your OpenRouter key in Settings.',
  }

  useGeneratorStore.setState({
    presetId: 'wan-3.0',
    resolution: '480p',
    aspectRatio: '16:9',
    audio: true,
    tab: 'frames',
    references: [],
  })
})

afterEach(cleanup)

describe('ModelRow without a key', () => {
  it('shows the catalog rate, the struck list rate and the reason', () => {
    mockUseModelEntry.mockReturnValue(catalogEntry('no_provider'))
    const handleSelect = vi.fn()

    render(
      <ModelRow model={videoPickerModel(WAN, null)} selected={false} onSelect={handleSelect} />,
    )

    const row = screen.getByRole('button')

    expect(within(row).getByText('$0.043/s').className).toContain('text-accent')
    expect(within(row).getByText('$0.05/s').className).toContain('line-through')
    expect(within(row).queryByText('15% off')).toBeNull()
    expect(within(row).getByText('Add your OpenRouter key in Settings.')).toBeTruthy()

    fireEvent.click(row)

    expect((row as HTMLButtonElement).disabled).toBe(true)
    expect(handleSelect).not.toHaveBeenCalled()
  })

  it('shows no price when the model is missing', () => {
    mockUseModelEntry.mockReturnValue(catalogEntry('missing'))

    render(<ModelRow model={videoPickerModel(WAN, null)} selected={false} onSelect={vi.fn()} />)

    const row = screen.getByRole('button')

    expect(within(row).queryByText('$0.043/s')).toBeNull()
    expect(within(row).queryByText('$0.05/s')).toBeNull()
    expect(within(row).queryByText('15% off')).toBeNull()
    expect(within(row).getByText('Add your OpenRouter key in Settings.')).toBeTruthy()
  })
})

describe('Generate button without a key', () => {
  it('shows no price, discount or spinner while the draft is invalid', async () => {
    mockUseModelEntry.mockReturnValue(catalogEntry('no_provider'))

    render(<GeneratorPanel />)

    const button = screen.getByRole('button', { name: /Generate/ })

    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(within(button).queryByText('$0.043/s')).toBeNull()
    expect(within(button).queryByText('$0.05/s')).toBeNull()
    expect(within(button).queryByText('15% off')).toBeNull()
    expect(within(button).queryByRole('status')).toBeNull()

    await settle(700)

    expect(mocks.fetchEstimate).not.toHaveBeenCalled()
  })

  it('shows the price while the prompt is the only missing field', async () => {
    const estimate: GenerationEstimate = {
      estimatedUsd: 0.51,
      listUsd: 0.6,
      pricePerSec: 0.1,
      priceSource: 'mock',
      discount: 0.15,
      referenceSeconds: 0,
    }

    mockUseModelEntry.mockReturnValue(catalogEntry('missing'))
    mocks.draft.settingsValidation = { ok: true, errors: [], warnings: [] }
    mocks.fetchEstimate.mockResolvedValue(estimate)

    render(
      <SwrWrapper>
        <GeneratorPanel />
      </SwrWrapper>,
    )

    const button = screen.getByRole('button', { name: /Generate/ })

    expect((button as HTMLButtonElement).disabled).toBe(true)

    await waitFor(
      () => {
        expect(within(button).getByText('≈ $0.51')).toBeTruthy()
      },
      { timeout: 2000 },
    )

    expect(mocks.fetchEstimate).toHaveBeenCalled()
  })

  it('shows the estimated total and requests it when the draft is valid', async () => {
    const estimate: GenerationEstimate = {
      estimatedUsd: 0.51,
      listUsd: 0.6,
      pricePerSec: 0.1,
      priceSource: 'mock',
      discount: 0.15,
      referenceSeconds: 0,
    }

    mocks.draft.validation = { ok: true, errors: [], warnings: [] }
    mocks.draft.settingsValidation = { ok: true, errors: [], warnings: [] }
    mocks.draft.isKeyMissing = false
    mocks.draft.provider = { isKeyMissing: false, isReady: true, reason: null }
    mocks.fetchEstimate.mockResolvedValue(estimate)

    render(
      <SwrWrapper>
        <GeneratorPanel />
      </SwrWrapper>,
    )

    const button = screen.getByRole('button', { name: /Generate/ })

    await waitFor(
      () => {
        expect(within(button).getByText('$0.51')).toBeTruthy()
      },
      { timeout: 2000 },
    )

    expect((button as HTMLButtonElement).disabled).toBe(false)
    expect(mocks.fetchEstimate).toHaveBeenCalled()
    expect(within(button).queryByText('15% off')).toBeNull()
  })
})

describe('Generator panel picker anchor', () => {
  it('registers the panel root as the generator anchor', () => {
    const view = render(<GeneratorPanel />)
    const panel = required(view.container.firstElementChild, 'generator panel')

    expect(pickerAnchor('generator')).toBe(panel)
    expect(panel.querySelector('[data-generator-panel]')).toBeTruthy()
  })
})
