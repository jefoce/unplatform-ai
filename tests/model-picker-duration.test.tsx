// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CatalogEntry } from '@/core/catalog'
import { formatRate } from '@/core/pricing'
import type { PricingInfo } from '@/core/types'
import { ModelPicker } from '@/features/generator/model/ModelPicker'
import { useGeneratorStore } from '@/features/generator/store/store'
import { useModelEntry } from '@/lib/api/models'
import { Price } from '@/ui/Price'

import { required } from './helpers/required'

vi.mock('@/lib/api/models', () => {
  return {
    useModelEntry: vi.fn(() => {
      return null
    }),
  }
})

const mockUseModelEntry = vi.mocked(useModelEntry)

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
  fetchedAt: '',
}

function entry(pricing: PricingInfo): CatalogEntry {
  return {
    modelId: 'alibaba/wan-3.0',
    presetId: 'wan-3.0',
    provider: 'openrouter',
    status: 'available',
    reason: null,
    pricing,
  }
}

function unavailable(status: 'missing' | 'no_provider', reason: string): CatalogEntry {
  return { ...entry(PRICING), status, reason }
}

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  mockUseModelEntry.mockReturnValue(null)
  useGeneratorStore.setState({ presetId: 'wan-3.0' })
  vi.stubGlobal('ResizeObserver', Observer)

  vi.stubGlobal('matchMedia', () => {
    return {
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }
  })
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('ModelPicker duration badge', () => {
  it('shows the billable range instead of the quick-chip options', () => {
    render(<ModelPicker />)
    fireEvent.click(screen.getByRole('button', { name: /Model/ }))
    const dialog = screen.getByRole('dialog')

    const cases = [
      ['Wan 3.0', '5-30s'],
      ['Wan 3.0 Prime', '5-30s'],
      ['Seedance 2.0', '4-15s'],
      ['Seedance 2.5', '4-30s'],
    ] as const

    for (const [title, badge] of cases) {
      const row = required(within(dialog).getByText(title).closest('button'), title)

      expect(within(row).getByText(badge), title).toBeTruthy()
    }
  })
})

describe('ModelPicker rows', () => {
  it('shows the struck list rate, the discounted rate and no description', () => {
    mockUseModelEntry.mockReturnValue(entry(PRICING))
    render(<ModelPicker />)
    fireEvent.click(screen.getByRole('button', { name: /Model/ }))
    const dialog = screen.getByRole('dialog')
    const row = within(dialog).getByText('Wan 3.0').closest('button') as HTMLElement

    expect(within(row).getByText('$0.05/s').className).toContain('line-through')
    expect(within(row).getByText('$0.043/s').className).toContain('text-lime')
    expect(within(dialog).queryByText('Blocks realistic faces in references')).toBeNull()
  })
})

describe('ModelPicker unavailable rows', () => {
  it('disables a missing row with the reason and no price', () => {
    mockUseModelEntry.mockReturnValue(
      unavailable('missing', 'Not available on OpenRouter right now.'),
    )

    render(<ModelPicker />)
    fireEvent.click(screen.getByRole('button', { name: /Model/ }))
    const dialog = screen.getByRole('dialog')
    const row = within(dialog).getByText('Wan 3.0').closest('button') as HTMLButtonElement

    expect(row.disabled).toBe(true)
    expect(within(row).getByText('Not available on OpenRouter right now.')).toBeTruthy()
    expect(within(row).queryByText('$0.05/s')).toBeNull()
    expect(within(row).queryByText('$0.043/s')).toBeNull()
  })

  it('keeps the selection and the picker open when a disabled row is clicked', () => {
    mockUseModelEntry.mockReturnValue(
      unavailable('missing', 'Not available on OpenRouter right now.'),
    )

    render(<ModelPicker />)
    fireEvent.click(screen.getByRole('button', { name: /Model/ }))
    const dialog = screen.getByRole('dialog')
    const row = within(dialog).getByText('Seedance 2.0').closest('button') as HTMLElement

    fireEvent.click(row)

    expect(useGeneratorStore.getState().presetId).toBe('wan-3.0')
    expect(screen.getByRole('dialog')).toBe(dialog)
  })

  it('selects an unverified row normally', () => {
    mockUseModelEntry.mockReturnValue({ ...entry(PRICING), status: 'unverified' })

    render(<ModelPicker />)
    fireEvent.click(screen.getByRole('button', { name: /Model/ }))
    const dialog = screen.getByRole('dialog')
    const row = within(dialog).getByText('Seedance 2.0').closest('button') as HTMLButtonElement

    expect(row.disabled).toBe(false)
    fireEvent.click(row)
    expect(useGeneratorStore.getState().presetId).toBe('seedance-2.0')
  })
})

describe('ModelPicker header', () => {
  it('shows only the percent off next to the Model label', () => {
    mockUseModelEntry.mockReturnValue(entry(PRICING))
    render(<ModelPicker />)
    const trigger = screen.getByRole('button', { name: /Model/ })

    expect(within(trigger).getByText('15% off').className).toContain('text-lime')
    expect(within(trigger).queryByText('$0.05/s')).toBeNull()
    expect(within(trigger).queryByText('$0.043/s')).toBeNull()
  })
})

describe('Price', () => {
  it('shows the struck list price and effective price without a label by default', () => {
    render(<Price current={0.0425} list={0.05} discount={0.15} format={formatRate} />)

    expect(screen.getByText('$0.05/s').className).toContain('line-through')
    expect(screen.getByText('$0.043/s').className).toContain('text-lime')
    expect(screen.queryByText(/% off/)).toBeNull()
  })

  it('shows the percent off only when asked', () => {
    render(
      <Price current={0.0425} list={0.05} discount={0.15} format={formatRate} showDiscountLabel />,
    )

    expect(screen.getByText('15% off').className).toContain('text-lime')
  })

  it('never wraps', () => {
    const { container } = render(<Price current={0.0425} format={formatRate} />)

    expect(container.firstElementChild?.className).toContain('whitespace-nowrap')
  })

  it('uses the onAccent tone on the lime button', () => {
    render(
      <Price
        current={0.0425}
        list={0.05}
        discount={0.15}
        format={formatRate}
        tone="onAccent"
        showDiscountLabel
      />,
    )

    expect(screen.getByText('$0.05/s').className).toContain('text-on-lime/50')
    expect(screen.getByText('$0.05/s').className).toContain('line-through')
    expect(screen.getByText('$0.043/s').className).toContain('text-on-lime')
    expect(screen.getByText('15% off').className).toContain('text-on-lime/70')
  })

  it('hides the struck price when list and current match', () => {
    const { container } = render(<Price current={0.05} list={0.05} format={formatRate} />)
    const current = screen.getByText('$0.05/s')

    expect(container.querySelector('.line-through')).toBeNull()
    expect(current.className).toContain('text-fg-2')
    expect(screen.queryByText(/% off/)).toBeNull()
  })
})
