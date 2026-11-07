// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { imagePickerModel } from '@/features/generator/model/image-picker-model'
import { ModelPicker } from '@/features/generator/model/ModelPicker'
import { ModelRow } from '@/features/generator/model/ModelRow'
import { ModelVideoRow } from '@/features/generator/model/ModelVideoRow'
import { videoPickerModel } from '@/features/generator/model/video-picker-model'
import { useModelEntry } from '@/lib/api/catalog'

import type { CatalogEntry } from '../src/core/catalog'
import type { PickerModel } from '../src/core/feed/picker-model'
import { getPreset } from '../src/core/presets'
import { IMAGE_PRESETS } from '../src/core/presets/image'
import type { PricingInfo } from '../src/core/pricing/types'

vi.mock('@/lib/api/catalog', () => {
  return {
    useCatalog: () => {
      return { catalog: undefined, isLoading: false, isValidating: false }
    },
    refreshCatalog: vi.fn(async () => {}),
    useModelEntry: vi.fn(() => {
      return null
    }),
  }
})

const mockUseModelEntry = vi.mocked(useModelEntry)
const WAN = getPreset('wan-3.0')

const PRICING: PricingInfo = {
  skus: { duration_seconds_480p: 0.05 },
  listSkus: { duration_seconds_480p: 0.06 },
  discount: 0,
  source: 'live',
  fetchedAt: '',
}

const IMAGE_ROW: PickerModel = {
  id: 'image-model',
  title: 'Image Model',
  icon: 'sparkles',
  description: 'A description',
  priceText: 'from $0.01',
}

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function handleNoop(): void {}

beforeEach(() => {
  mockUseModelEntry.mockReturnValue(null)
  vi.stubGlobal('ResizeObserver', Observer)

  vi.stubGlobal('matchMedia', () => {
    return { matches: false, addEventListener: handleNoop, removeEventListener: handleNoop }
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('videoPickerModel', () => {
  it('builds the row view from the preset and the live entry', () => {
    const entry: CatalogEntry = {
      modelId: 'alibaba/wan-3.0',
      presetId: 'wan-3.0',
      provider: 'openrouter',
      status: 'available',
      reason: null,
      pricing: PRICING,
      availability: { status: 'available', reason: null },
      source: {
        kind: 'openrouter',
        instanceId: 'openrouter',
        badge: null,
        workflowName: null,
        local: false,
      },
    }

    const model = videoPickerModel(WAN, entry)

    expect(model.id).toBe(WAN.id)
    expect(model.title).toBe(WAN.title)
    expect(model.icon).toBe(WAN.icon)
    expect(model.description).toContain('5-30s')
    expect(model.priceText).toBe('from $0.05/s')
  })
})

describe('ModelRow generic view', () => {
  it('renders the description and the price text', () => {
    render(<ModelRow model={IMAGE_ROW} selected={false} onSelect={vi.fn()} />)

    expect(screen.getByText('Image Model')).toBeTruthy()
    expect(screen.getByText('A description')).toBeTruthy()
    expect(screen.getByText('from $0.01')).toBeTruthy()
  })

  it('reports the selected state on the row button', () => {
    const { rerender } = render(<ModelRow model={IMAGE_ROW} selected={false} onSelect={vi.fn()} />)

    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false')

    rerender(<ModelRow model={IMAGE_ROW} selected onSelect={vi.fn()} />)

    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')
  })
})

describe('ModelRow image view', () => {
  it('disables a missing image model and shows the reason', () => {
    const preset = IMAGE_PRESETS[0]
    const handleSelect = vi.fn()

    mockUseModelEntry.mockReturnValue({
      modelId: preset.bindings[0].modelId,
      presetId: preset.id,
      provider: 'openrouter',
      status: 'missing',
      reason: 'Not available on OpenRouter right now.',
      pricing: null,
      availability: { status: 'missing', reason: 'Not available on OpenRouter right now.' },
      source: {
        kind: 'openrouter',
        instanceId: 'openrouter',
        badge: null,
        workflowName: null,
        local: false,
      },
    })

    render(<ModelRow model={imagePickerModel(preset)} selected={false} onSelect={handleSelect} />)

    const row = screen.getByRole('button')

    expect((row as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Not available on OpenRouter right now.')).toBeTruthy()

    fireEvent.click(row)

    expect(handleSelect).not.toHaveBeenCalled()
  })
})

describe('ModelVideoRow', () => {
  const LONG_TITLE = 'Wan 3.0 Ultra Long Title That Would Wrap'

  const LONG_ROW: PickerModel = {
    id: WAN.id,
    title: LONG_TITLE,
    icon: WAN.icon,
    description: '',
    priceText: '',
  }

  const DISCOUNTED_ENTRY: CatalogEntry = {
    modelId: 'alibaba/wan-3.0',
    presetId: 'wan-3.0',
    provider: null,
    status: 'no_provider',
    reason: null,
    pricing: { ...PRICING, listSkus: { duration_seconds_480p: 0.06 }, discount: 0.15 },
    availability: { status: 'no_provider', reason: null },
    source: {
      kind: 'openrouter',
      instanceId: 'openrouter',
      badge: null,
      workflowName: null,
      local: false,
    },
  }

  it('keeps a long title on one truncated line and still shows the price', () => {
    render(
      <ModelVideoRow
        model={LONG_ROW}
        preset={WAN}
        entry={DISCOUNTED_ENTRY}
        selected={false}
        onSelect={vi.fn()}
      />,
    )

    const title = screen.getByText(LONG_TITLE)

    expect(title.className).toContain('truncate')
    expect(title.className).toContain('whitespace-nowrap')
    expect(title.className).not.toContain('wrap-break-word')
    expect(screen.getByText('$0.05/s')).toBeTruthy()
  })

  it('keeps the discounted price green without the discount label', () => {
    render(
      <ModelVideoRow
        model={LONG_ROW}
        preset={WAN}
        entry={DISCOUNTED_ENTRY}
        selected={false}
        onSelect={vi.fn()}
      />,
    )

    const row = screen.getByRole('button', { name: new RegExp(LONG_TITLE) })

    expect(screen.getByText('$0.05/s').className).toContain('text-accent')
    expect(row.textContent).not.toMatch(/% off/)
  })

  it('omits the discount label from the row', () => {
    render(
      <ModelVideoRow
        model={LONG_ROW}
        preset={WAN}
        entry={DISCOUNTED_ENTRY}
        selected={false}
        onSelect={vi.fn()}
      />,
    )

    const row = screen.getByRole('button', { name: new RegExp(LONG_TITLE) })

    expect(row.textContent).not.toMatch(/% off/)
    expect(row.textContent).not.toMatch(/\boff\b/)
  })
})

describe('ModelPicker bar variant', () => {
  it('shows the full title and a right chevron without truncation', () => {
    render(<ModelPicker variant="bar" models={[IMAGE_ROW]} selectedId="image-model" />)

    const trigger = screen.getByRole('button', { name: 'Image Model' })

    expect(trigger.textContent).toBe('Image Model')
    expect(trigger.querySelector('svg.lucide-chevron-right')).not.toBeNull()
    expect(trigger.className).toContain('text-sm')
    expect(trigger.className).toContain('font-semibold')
    expect(trigger.className).not.toContain('truncate')
    expect(screen.getByText('Image Model').className).toContain('whitespace-nowrap')
  })
})

describe('ModelPicker custom models', () => {
  it('selects from the supplied PickerModel list', () => {
    const handleSelect = vi.fn()

    render(<ModelPicker models={[IMAGE_ROW]} selectedId="missing" onSelect={handleSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /Model/ }))
    fireEvent.click(screen.getByRole('button', { name: /Image Model/ }))

    expect(handleSelect).toHaveBeenCalledWith('image-model')
  })
})
