'use client'

import { forwardRef } from 'react'
import { Search } from 'lucide-react'

import { cn } from '@/lib/cn'

import { Input, type InputProps } from './Input'

/** Search input with a leading icon. */
export const SearchInput = forwardRef<HTMLInputElement, InputProps>(
  function SearchInput(props, ref) {
    const { className, ...rest } = props

    return (
      <div className="relative shrink-0">
        <Search
          size={14}
          className="pointer-events-none absolute top-2.5 left-2.5 text-fg-2"
          aria-hidden
        />
        <Input ref={ref} {...rest} className={cn('pl-8', className)} />
      </div>
    )
  },
)
