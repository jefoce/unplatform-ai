'use client'

import { type ChangeEvent, type FocusEvent, forwardRef, useEffect, useState } from 'react'
import { clamp, isNil, omit, round } from 'lodash-es'

import { Input, type InputProps } from './Input'

interface NumberInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type' | 'min' | 'max'> {
  value: number | null
  onValueChange: (value: number | null) => void
  min?: number
  max?: number
}

const format = (value: number | null): string => {
  if (isNil(value)) {
    return ''
  }

  return String(value)
}

const parse = (text: string): number | null => {
  if (text.trim() === '') {
    return null
  }

  const value = Number(text)

  if (Number.isFinite(value)) {
    return value
  }

  return null
}

/** Number input that reports null when empty and rounds/clamps on blur. */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput(props, ref) {
    // Callback read as props.onValueChange per lint rule. omit keeps it off the DOM input.
    const { value, min, max, ...rest } = omit(props, 'onValueChange')
    const [draft, setDraft] = useState(format(value))

    useEffect(() => {
      if (parse(draft) !== value) {
        setDraft(format(value))
      }
    }, [value, draft])

    const commit = () => {
      const parsed = parse(draft)

      if (isNil(parsed)) {
        props.onValueChange(null)
        setDraft('')

        return
      }

      const next = clamp(round(parsed), min ?? -Infinity, max ?? Infinity)

      props.onValueChange(next)
      setDraft(String(next))
    }

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      setDraft(event.target.value)
      props.onValueChange(parse(event.target.value))
    }

    const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
      commit()
      props.onBlur?.(event)
    }

    return (
      <Input
        ref={ref}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft}
        onChange={handleChange}
        onBlur={handleBlur}
        {...rest}
      />
    )
  },
)
