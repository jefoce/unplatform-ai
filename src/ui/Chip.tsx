'use client'

import { forwardRef } from 'react'

import { cn } from '@/lib/cn'

export type ChipSize = 'sm' | 'bar'

type ChipVariant = 'default' | 'warning'

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ChipVariant
  size?: ChipSize
}

/** Type scale shared by every setting chip in both bars. */
export const CHIP_TEXT_CLASSES = 'text-sm font-semibold'

/** Height, radius, background and text shared by every bar control. */
export const BAR_CONTROL_CLASSES = 'h-8 rounded-lg bg-hover text-sm font-semibold'

/** Icon-only button that matches the bar controls. */
export const BAR_ICON_CLASSES =
  'flex size-8 shrink-0 items-center justify-center rounded-lg bg-hover text-sm text-fg-2 transition hover:text-fg'

const VARIANTS = {
  default: 'bg-page-2 text-fg hover:bg-white/5',
  warning: 'bg-warn text-white hover:brightness-110',
} satisfies Record<ChipVariant, string>

const SIZES = {
  sm: 'h-6 gap-1.5 rounded-lg px-1.5 text-xs/4 font-medium',
  bar: `${BAR_CONTROL_CLASSES} gap-1.5 shrink-0 px-2.5 whitespace-nowrap hover:bg-white/10`,
} satisfies Record<ChipSize, string>

/** Prompt chip, also usable as a popover trigger. */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(props, ref) {
  const { variant = 'default', size = 'sm', className, children, type = 'button', ...rest } = props

  return (
    <button
      ref={ref}
      type={type}
      {...rest}
      className={cn('inline-flex items-center', VARIANTS[variant], SIZES[size], className)}
    >
      {children}
    </button>
  )
})
