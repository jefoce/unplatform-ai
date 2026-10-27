// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { GenerateButton } from '@/features/generator/generate/GenerateButton'

afterEach(cleanup)

const handleNoop = () => {}

describe('GenerateButton', () => {
  it('shows a spinner without disabling the button while the estimate loads', () => {
    render(
      <GenerateButton
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

    expect((button as HTMLButtonElement).disabled).toBe(false)
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('status').className).toContain('border-t-on-lime')
    expect(screen.queryByText('$1.50')).toBeNull()
  })

  it('shows no spinner while disabled during an estimate request', () => {
    render(
      <GenerateButton
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
    expect(button.getAttribute('aria-busy')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText('$1.50')).toBeNull()
    expect(screen.queryByText('25% off')).toBeNull()
  })

  it('spins while generating', () => {
    render(
      <GenerateButton
        onGenerate={handleNoop}
        isGenerating
        isPriceLoading={false}
        disabled={false}
        price={1.5}
        listPrice={2}
        discount={0.25}
      />,
    )

    const button = screen.getByRole('button')

    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('shows the price when idle', () => {
    render(
      <GenerateButton
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

describe('GenerateButton disabled state', () => {
  it('still disables for validation without an estimate request', () => {
    render(
      <GenerateButton
        onGenerate={handleNoop}
        isGenerating={false}
        isPriceLoading={false}
        disabled
        error="Prompt is required"
        price={1.5}
        listPrice={2}
        discount={0.25}
      />,
    )

    const button = screen.getByRole('button')

    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText('$1.50')).toBeNull()
  })

  it('keeps the tooltip trigger wrapper around a disabled button with an error', () => {
    render(
      <GenerateButton
        onGenerate={handleNoop}
        isGenerating={false}
        isPriceLoading={false}
        disabled
        error="Prompt is required"
        price={1.5}
        listPrice={2}
        discount={0.25}
      />,
    )

    const button = screen.getByRole('button')

    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(button.parentElement?.tagName).toBe('SPAN')
    expect(button.parentElement?.className).toContain('block w-full')
    expect(screen.queryByText('$1.50')).toBeNull()
  })
})
