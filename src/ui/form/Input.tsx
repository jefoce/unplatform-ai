'use client'

import { forwardRef } from 'react'

import { cn } from '@/lib/cn'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

/** Single-line input with the shared field look. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(props, ref) {
  const { className, ...rest } = props

  return (
    <input
      ref={ref}
      {...rest}
      className={cn(
        'h-9 w-full rounded-lg border border-line bg-page-2 px-3 text-sm text-fg outline-none placeholder:text-fg-2 disabled:opacity-50 aria-invalid:border-danger/60',
        className,
      )}
    />
  )
})
