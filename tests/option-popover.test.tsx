// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CheckItem } from '@/ui/CheckItem'
import { OptionPopover } from '@/ui/OptionPopover'

import { Observer } from './helpers/history'
import { required } from './helpers/required'

const LABELS = { '1K': '1K', '2K': '2K' }

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('CheckItem', () => {
  it('exposes its checked state and reports the picked value', () => {
    const handleSelect = vi.fn()

    render(<CheckItem label="High" value="high" isChecked onSelect={handleSelect} />)

    const row = screen.getByRole('radio', { name: 'High' })

    expect(row.getAttribute('aria-checked')).toBe('true')
    expect(row.className).toContain('focus-visible:bg-hover')

    fireEvent.click(row)

    expect(handleSelect).toHaveBeenCalledWith('high')
  })
})

describe('OptionPopover', () => {
  it('shows the header, marks the current value and picks another', async () => {
    const handleValueChange = vi.fn()

    render(
      <OptionPopover
        label="Resolution"
        options={['1K', '2K']}
        labels={LABELS}
        value="1K"
        onValueChange={handleValueChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Resolution: 1K' }))

    expect(screen.getByRole('radiogroup', { name: 'Resolution' })).not.toBeNull()
    expect(await screen.findByText('Resolution')).not.toBeNull()

    expect(screen.getByRole('radio', { name: '1K' }).getAttribute('aria-checked')).toBe('true')

    expect(screen.getByRole('radio', { name: '2K' }).getAttribute('aria-checked')).toBe('false')

    fireEvent.click(screen.getByRole('radio', { name: '2K' }))

    expect(handleValueChange).toHaveBeenCalledWith('2K')

    await waitFor(() => {
      expect(screen.queryByRole('radio')).toBeNull()
    })
  })

  it('moves the radio selection with the arrow keys', async () => {
    const handleValueChange = vi.fn()

    render(
      <OptionPopover
        label="Resolution"
        options={['1K', '2K']}
        labels={LABELS}
        value="1K"
        onValueChange={handleValueChange}
        closeOnPick={false}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Resolution: 1K' }))

    const first = await screen.findByRole('radio', { name: '1K' })
    const second = screen.getByRole('radio', { name: '2K' })

    expect(first.getAttribute('tabindex')).toBe('0')
    expect(second.getAttribute('tabindex')).toBe('-1')

    fireEvent.keyDown(first, { key: 'ArrowDown' })

    expect(handleValueChange).toHaveBeenCalledWith('2K')
    expect(document.activeElement).toBe(second)
  })

  it('hides the menu while disabled', () => {
    render(
      <OptionPopover
        label="Quality"
        options={['high']}
        labels={{ high: 'High' }}
        value="high"
        disabled
        onValueChange={vi.fn()}
      />,
    )

    const trigger = required(screen.getByRole('button', { name: 'Quality: High' }), 'trigger')

    expect((trigger as HTMLButtonElement).disabled).toBe(true)
  })
})

function renderResolution(): HTMLButtonElement {
  render(
    <OptionPopover
      label="Resolution"
      options={['1K', '2K']}
      labels={LABELS}
      value="1K"
      onValueChange={vi.fn()}
    />,
  )

  return screen.getByRole('button', { name: 'Resolution: 1K' })
}

describe('OptionPopover close focus', () => {
  it('returns focus to the trigger on Escape', async () => {
    const trigger = renderResolution()

    trigger.focus()
    fireEvent.click(trigger)

    const group = await screen.findByRole('radiogroup', { name: 'Resolution' })

    fireEvent.keyDown(group, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('radiogroup')).toBeNull()
    })

    expect(document.activeElement).toBe(trigger)
  })

  it('leaves focus off the trigger on a pointer close', async () => {
    const trigger = renderResolution()

    fireEvent.click(trigger)

    await screen.findByRole('radiogroup', { name: 'Resolution' })

    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })

    fireEvent.pointerDown(document.body, { button: 0 })
    fireEvent.click(document.body)

    await waitFor(() => {
      expect(screen.queryByRole('radiogroup')).toBeNull()
    })

    expect(document.activeElement).not.toBe(trigger)
  })
})
