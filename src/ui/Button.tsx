'use client'

import { forwardRef } from 'react'

import { cn } from '@/lib/cn'

import { Spinner } from './Spinner'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'

type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const VARIANTS = {
  primary:
    'bg-[radial-gradient(circle,var(--color-lime-hi)_40%,var(--color-lime))] pb-0.5 text-on-lime shadow-[inset_0_-3px_rgba(0,0,0,0.43)] hover:opacity-80 active:scale-[0.97] active:opacity-60 disabled:bg-disabled-surface disabled:text-disabled disabled:opacity-100',
  secondary: 'bg-surface-2 text-fg hover:bg-white/10',
  ghost: 'bg-transparent text-fg hover:bg-white/5',
  outline: 'border border-line-strong bg-transparent text-fg hover:bg-white/5',
  danger: 'border border-danger/40 bg-transparent text-danger hover:bg-danger/10',
} satisfies Record<ButtonVariant, string>

const SIZES = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-4 text-sm',
  icon: 'h-10 w-10 p-0',
} satisfies Record<ButtonSize, string>

/** Native button with variant, size and loading states. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(props, ref) {
  const {
    variant = 'secondary',
    size = 'md',
    loading: isLoading = false,
    disabled: isDisabled,
    className,
    children,
    type = 'button',
    ...rest
  } = props

  const spinnerTone = variant === 'primary' ? 'lime' : 'muted'

  return (
    <button
      ref={ref}
      type={type}
      {...rest}
      disabled={isDisabled === true || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap transition select-none',
        'disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {isLoading && <Spinner size={16} tone={spinnerTone} />}
      {children}
    </button>
  )
})
