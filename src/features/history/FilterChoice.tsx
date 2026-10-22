'use client'

import { type MouseEvent, useCallback } from 'react'

import { cn } from '@/lib/cn'

interface FilterChoiceProps<T extends string> {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
}

/** One labelled row of single-choice filter buttons. */
export function FilterChoice<T extends string>(props: FilterChoiceProps<T>) {
  const { label, value, options, onChange } = props
  const handleSelect = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => onChange(event.currentTarget.value as T),
    [onChange],
  )

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-fg-2">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            value={option.value}
            onClick={handleSelect}
            className={cn(
              'h-8 rounded-lg px-2 text-sm transition',
              option.value === value
                ? 'bg-white/10 text-fg'
                : 'text-fg-2 hover:bg-hover hover:text-fg',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
