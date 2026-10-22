// @vitest-environment jsdom
import { useCallback, useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Field } from '@/ui/form/Field'
import { Input } from '@/ui/form/Input'
import { NumberInput } from '@/ui/form/NumberInput'
import { PasswordInput } from '@/ui/form/PasswordInput'

afterEach(cleanup)

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
