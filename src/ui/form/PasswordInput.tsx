'use client'

import { forwardRef } from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { isNonEmptyString } from '@/core/guards'
import { cn } from '@/lib/cn'
import { useBoolean } from '@/lib/use-boolean'

import { Input, type InputProps } from './Input'

/** Password input with a reveal toggle, disabled while empty or disabled. */
export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(
  function PasswordInput(props, ref) {
    const { className, disabled: isDisabled, value, ...rest } = props
    const reveal = useBoolean()
    const isValueEmpty = !isNonEmptyString(value)

    const canReveal = reveal.value && !isValueEmpty
    const inputType = canReveal ? 'text' : 'password'
    const RevealIcon = reveal.value ? EyeOff : Eye
    const revealLabel = reveal.value ? 'Hide value' : 'Show value'

    return (
      <div className="relative flex-1">
        <Input
          ref={ref}
          type={inputType}
          autoComplete="off"
          spellCheck={false}
          disabled={isDisabled}
          value={value}
          {...rest}
          className={cn('pr-9', className)}
        />
        {isDisabled !== true && (
          <button
            type="button"
            onClick={reveal.toggle}
            disabled={isValueEmpty}
            aria-label={revealLabel}
            className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-fg-2 hover:text-fg disabled:opacity-30"
          >
            <RevealIcon size={13} />
          </button>
        )}
      </div>
    )
  },
)
