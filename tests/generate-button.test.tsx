// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { GENERATE_DISABLED_CLASSES } from '@/features/generator/generate/generate-surface'
import { GenerateButton } from '@/features/generator/generate/GenerateButton'

afterEach(cleanup)

const handleNoop = () => {}

const VARIANTS = ['panel', 'compact'] as const

interface DisabledParams {
  variant: (typeof VARIANTS)[number]
}

function disabledButton(params: DisabledParams) {
  return (
    <GenerateButton
      variant={params.variant}
      onGenerate={handleNoop}
      isGenerating={false}
      isPriceLoading={false}
      disabled
      error="Prompt is required"
      price={null}
      listPrice={null}
      discount={0}
      isApproximate={params.variant === 'compact'}
    />
  )
}

describe.each(VARIANTS)('%s GenerateButton disabled state', (variant) => {
  it('uses the shared disabled surface and shows the reason', async () => {
    render(disabledButton({ variant }))

    const button = screen.getByRole('button')

    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(button.className).toContain(GENERATE_DISABLED_CLASSES)
    expect(button.parentElement?.tagName).toBe('SPAN')

    fireEvent.focus(button)

    const tooltip = await screen.findByRole('tooltip')

    expect(tooltip.textContent).toBe('Prompt is required')
  })

  it('disables while the price is loading and describes the wait', async () => {
    render(
      <GenerateButton
        variant={variant}
        onGenerate={handleNoop}
        isGenerating={false}
        isPriceLoading
        disabled={false}
        price={null}
      />,
    )

    const button = screen.getByRole('button')
    const hint = screen.getByText('Getting price')

    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(button.className).toContain(GENERATE_DISABLED_CLASSES)
    expect(button.getAttribute('aria-describedby')).toBe(hint.id)

    fireEvent.focus(button)

    expect((await screen.findByRole('tooltip')).textContent).toBe('Getting price')
  })

  it('disables when the price is missing and describes why', async () => {
    render(
      <GenerateButton
        variant={variant}
        onGenerate={handleNoop}
        isGenerating={false}
        isPriceLoading={false}
        disabled={false}
        price={null}
      />,
    )

    const button = screen.getByRole('button')
    const hint = screen.getByText('Price unavailable')

    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(button.className).toContain(GENERATE_DISABLED_CLASSES)
    expect(button.getAttribute('aria-describedby')).toBe(hint.id)

    fireEvent.focus(button)

    expect((await screen.findByRole('tooltip')).textContent).toBe('Price unavailable')
  })
})

describe('variant sizes', () => {
  it('keeps the full-width panel height for video', () => {
    render(
      <GenerateButton
        variant="panel"
        onGenerate={handleNoop}
        isGenerating={false}
        isPriceLoading={false}
        disabled={false}
        price={1.5}
        listPrice={2}
        discount={0.25}
      />,
    )

    const button = screen.getByRole('button')

    expect(button.className).toContain('h-12')
    expect(button.className).toContain('w-full')
  })

  it('keeps the 120 by 80 column size for images', () => {
    render(
      <GenerateButton
        variant="compact"
        onGenerate={handleNoop}
        isGenerating={false}
        isPriceLoading={false}
        disabled={false}
        price={0.02}
      />,
    )

    const button = screen.getByRole('button')

    expect(button.className).toContain('h-20')
    expect(button.className).toContain('w-30')
    expect(button.className).toContain('flex-col')
  })
})

describe('panel GenerateButton', () => {
  it('disables and shows a spinner while the estimate loads', () => {
    render(
      <GenerateButton
        variant="panel"
        onGenerate={handleNoop}
        isGenerating={false}
        isPriceLoading
        disabled={false}
        price={1.5}
        listPrice={2}
        discount={0.25}
      />,
    )

    const button = screen.getByRole('button')

    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('status').className).toContain('border-t-on-accent')
    expect(screen.queryByText('$1.50')).toBeNull()
    expect(screen.getByText('Getting price')).toBeTruthy()
  })

  it('keeps the validation reason ahead of the price hint', async () => {
    render(
      <GenerateButton
        variant="panel"
        onGenerate={handleNoop}
        isGenerating={false}
        isPriceLoading
        disabled
        error="Prompt is required"
        price={1.5}
        listPrice={2}
        discount={0.25}
      />,
    )

    const button = screen.getByRole('button')

    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(screen.queryByText('≈ $1.50')).toBeNull()
    expect(screen.queryByText('25% off')).toBeNull()
    expect(screen.getByText('Getting price')).toBeTruthy()

    fireEvent.focus(button)

    expect((await screen.findByRole('tooltip')).textContent).toBe('Prompt is required')
  })

  it('shows the price when idle', () => {
    render(
      <GenerateButton
        variant="panel"
        onGenerate={handleNoop}
        isGenerating={false}
        isPriceLoading={false}
        disabled={false}
        price={1.5}
        listPrice={2}
        discount={0.25}
      />,
    )

    expect(screen.getByText('$1.50')).toBeTruthy()
    expect(screen.queryByText('25% off')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('compact GenerateButton', () => {
  it('prefixes the estimate with ~ when approximate', () => {
    render(
      <GenerateButton
        variant="compact"
        onGenerate={handleNoop}
        isGenerating={false}
        isPriceLoading={false}
        disabled
        error="Prompt is required"
        price={0.02}
        isApproximate
      />,
    )

    expect(screen.getByText('~$0.02')).toBeTruthy()
  })

  it('spins while submitting', () => {
    render(
      <GenerateButton
        variant="compact"
        onGenerate={handleNoop}
        isGenerating
        isPriceLoading={false}
        disabled={false}
        price={0.02}
      />,
    )

    const button = screen.getByRole('button')

    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('status')).toBeTruthy()
  })
})
