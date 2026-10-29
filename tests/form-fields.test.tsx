// @vitest-environment jsdom
import { useCallback, useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Field } from '@/ui/form/Field'
import { Input } from '@/ui/form/Input'
import { NumberInput } from '@/ui/form/NumberInput'
import { PasswordInput } from '@/ui/form/PasswordInput'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const handleNoop = () => {}

describe('Field', () => {
  it('wires label, described-by and invalid state', () => {
    render(
      <Field id="name" label="Name" hint="Optional" error="Required">
        <Input value="" onChange={handleNoop} />
      </Field>,
    )

    const input = screen.getByLabelText('Name')

    expect(input.id).toBe('name')
    expect(input.getAttribute('aria-invalid')).toBe('true')

    const describedBy = (input.getAttribute('aria-describedby') ?? '').split(' ')

    expect(describedBy).toContain('name-hint')
    expect(describedBy).toContain('name-error')
  })

  it('renders the hint on its own line below the label', () => {
    render(
      <Field id="name" label="Name" hint="Optional">
        <Input value="" onChange={handleNoop} />
      </Field>,
    )

    const label = screen.getByText('Name')
    const hint = screen.getByText('Optional')

    expect(label.contains(hint)).toBe(false)
    expect(hint.parentElement).toBe(label.parentElement)
  })
})

function NumberHarness({ onValueChange }: { onValueChange: (value: number | null) => void }) {
  const [value, setValue] = useState<number | null>(1)

  const handleValueChange = useCallback(
    (next: number | null) => {
      setValue(next)
      onValueChange(next)
    },
    [onValueChange],
  )

  return (
    <NumberInput
      aria-label="Count"
      value={value}
      min={0}
      max={10}
      onValueChange={handleValueChange}
    />
  )
}

describe('NumberInput', () => {
  it('keeps onValueChange off the native input', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const handleChanges = vi.fn()

    render(<NumberHarness onValueChange={handleChanges} />)
    fireEvent.change(screen.getByLabelText('Count'), { target: { value: '3' } })

    expect(handleChanges).toHaveBeenLastCalledWith(3)

    const messages = consoleError.mock.calls.map((args) => {
      return args.map(String).join(' ')
    })

    expect(
      messages.some((message) => {
        return message.includes('Unknown event handler property')
      }),
    ).toBe(false)
  })

  it('reports null when empty, then rounds and clamps on blur', () => {
    const handleChanges = vi.fn()

    render(<NumberHarness onValueChange={handleChanges} />)
    const input = screen.getByLabelText<HTMLInputElement>('Count')

    fireEvent.change(input, { target: { value: '' } })
    expect(handleChanges).toHaveBeenLastCalledWith(null)
    expect(input.value).toBe('')

    fireEvent.change(input, { target: { value: '7.6' } })
    fireEvent.blur(input)
    expect(handleChanges).toHaveBeenLastCalledWith(8)
    expect(input.value).toBe('8')

    fireEvent.change(input, { target: { value: '42' } })
    fireEvent.blur(input)
    expect(handleChanges).toHaveBeenLastCalledWith(10)
    expect(input.value).toBe('10')
  })
})

describe('PasswordInput', () => {
  it('disables reveal while empty', () => {
    render(<PasswordInput aria-label="Secret" value="" onChange={handleNoop} />)
    const input = screen.getByLabelText<HTMLInputElement>('Secret')
    const toggle = screen.getByRole<HTMLButtonElement>('button', { name: 'Show value' })

    expect(input.type).toBe('password')
    expect(toggle.disabled).toBe(true)

    fireEvent.click(toggle)
    expect(input.type).toBe('password')
  })

  it('reveals a filled value', () => {
    render(<PasswordInput aria-label="Secret" value="abc" onChange={handleNoop} />)
    const input = screen.getByLabelText<HTMLInputElement>('Secret')

    fireEvent.click(screen.getByRole('button', { name: 'Show value' }))
    expect(input.type).toBe('text')
    expect(screen.getByRole('button', { name: 'Hide value' })).toBeTruthy()
  })
})
