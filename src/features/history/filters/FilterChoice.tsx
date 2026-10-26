'use client'

import { type MouseEvent } from 'react'

import { isOneOf } from '@/core/guards'
import { cn } from '@/lib/cn'

export interface FilterOption<T extends string> {
  value: T
  label: string
}

interface FilterChoiceProps<T extends string> {
  label: string
  value: T
  options: readonly FilterOption<T>[]
  onChange: (value: T) => void
}

/** One labelled row of single-choice filter buttons. */
export function FilterChoice<T extends string>(props: FilterChoiceProps<T>) {
  const { label, value, options } = props

  const handleSelect = (event: MouseEvent<HTMLButtonElement>) => {
    const next = event.currentTarget.value

    const allowed = options.map((option) => {
      return option.value
    })

    if (!isOneOf(allowed, next)) {
      return
    }

    props.onChange(next)
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-fg-2">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => {
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={option.value === value}
              value={option.value}
              onClick={handleSelect}
              className={cn(
                'h-8 rounded-lg px-2 text-sm transition',
                option.value === value && 'bg-white/10 text-fg',
                !(option.value === value) && 'text-fg-2 hover:bg-hover hover:text-fg',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
