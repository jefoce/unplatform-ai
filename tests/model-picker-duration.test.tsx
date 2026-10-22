// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { formatRate } from '@/core/pricing'
import type { PricingInfo } from '@/core/types'
import { ModelPicker } from '@/features/generator/ModelPicker'
import { usePricing } from '@/features/generator/use-pricing'
import { Price } from '@/ui/Price'

vi.mock('@/features/generator/use-pricing', () => ({
  usePricing: vi.fn(() => ({ pricing: undefined })),
}))

const mockUsePricing = vi.mocked(usePricing)

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

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  mockUsePricing.mockReturnValue({ pricing: undefined })
  vi.stubGlobal('ResizeObserver', Observer)
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
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
    ]

    for (const [title, badge] of cases) {
      const row = within(dialog).getByText(title).closest('button')

      expect(row, title).not.toBeNull()
      expect(within(row as HTMLElement).getByText(badge), title).toBeTruthy()
    }
  })
})

describe('ModelPicker rows', () => {
  it('shows the struck list rate, the discounted rate and no description', () => {
    mockUsePricing.mockReturnValue({ pricing: PRICING })
    render(<ModelPicker />)
    fireEvent.click(screen.getByRole('button', { name: /Model/ }))
    const dialog = screen.getByRole('dialog')
    const row = within(dialog).getByText('Wan 3.0').closest('button') as HTMLElement

    expect(within(row).getByText('$0.05/s').className).toContain('line-through')
    expect(within(row).getByText('$0.043/s').className).toContain('text-lime')
    expect(within(dialog).queryByText('Blocks realistic faces in references')).toBeNull()
  })
})

describe('ModelPicker header', () => {
  it('shows only the percent off next to the Model label', () => {
    mockUsePricing.mockReturnValue({ pricing: PRICING })
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
