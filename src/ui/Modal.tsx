'use client'

import { Dialog as DialogPrimitive } from 'radix-ui'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode

  /** Size, padding and background only. Never position classes. */
  className?: string
  backdropClassName?: string
  hideOverlay?: boolean
  label: string
}

/** Centered modal dialog with Esc and overlay-click close. */
export function Modal(props: ModalProps) {
  const {
    open: isOpen,
    onOpenChange: handleOpenChange,
    children,
    className,
    backdropClassName,
    hideOverlay: shouldHideOverlay,
    label,
  } = props

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        {shouldHideOverlay !== true && (
          <DialogPrimitive.Overlay
            className={cn('fixed inset-0 z-50 bg-backdrop', backdropClassName)}
          />
        )}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            'fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[min(900px,90vw)] -translate-1/2',
            'rounded-2xl border border-line-strong bg-surface shadow-[0_0_0_1px_var(--color-overlay),0_24px_60px_-20px_var(--color-backdrop)] outline-none',
            className,
          )}
        >
          <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
