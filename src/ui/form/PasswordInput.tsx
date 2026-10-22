'use client'

import { forwardRef, useCallback, useState } from 'react'
import { isNil } from 'lodash-es'
import { Eye, EyeOff } from 'lucide-react'

import { cn } from '@/lib/cn'

import { Input, type InputProps } from './Input'

/** Password input with a reveal toggle, disabled while empty or disabled. */
export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(
  function PasswordInput(props, ref) {
    const { className, disabled: isDisabled, value, ...rest } = props
    const [isRevealed, setIsRevealed] = useState(false)
    const isValueEmpty = isNil(value) || value === ''
    const handleToggleRevealed = useCallback(() => setIsRevealed((isCurrent) => !isCurrent), [])

    return (
      <div className="relative flex-1">
        <Input
          ref={ref}
          type={isRevealed && !isValueEmpty ? 'text' : 'password'}
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
            onClick={handleToggleRevealed}
            disabled={isValueEmpty}
            aria-label={isRevealed ? 'Hide value' : 'Show value'}
            className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-fg-2 hover:text-fg disabled:opacity-30"
          >
            {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        )}
      </div>
    )
  },
)
