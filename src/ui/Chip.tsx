'use client'

import { forwardRef } from 'react'

import { cn } from '@/lib/cn'

type ChipVariant = 'default' | 'warning'

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ChipVariant
}

const VARIANTS = {
  default: 'bg-page-2 text-fg hover:bg-white/5',
  warning: 'bg-warn text-white hover:brightness-110',
} satisfies Record<ChipVariant, string>

/** One-size prompt chip, also usable as a popover trigger. */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(props, ref) {
  const { variant = 'default', className, children, type = 'button', ...rest } = props

  return (
    <button
      ref={ref}
      type={type}
      {...rest}
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-lg px-1.5 text-xs/4 font-medium',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </button>
  )
})
