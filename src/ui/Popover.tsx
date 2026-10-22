'use client'

import { forwardRef } from 'react'
import { Popover as PopoverPrimitive } from 'radix-ui'

import { cn } from '@/lib/cn'

export const Popover = PopoverPrimitive.Root
export const PopoverClose = PopoverPrimitive.Close
export const PopoverTrigger = PopoverPrimitive.Trigger

function handleCloseAutoFocus(event: Event): void {
  event.preventDefault()
}

/** Floating panel anchored to a trigger. */
export const PopoverContent = forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(function PopoverContent(props, ref) {
  const { className, sideOffset = 8, align = 'center', ...rest } = props

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        onCloseAutoFocus={handleCloseAutoFocus}
        {...rest}
        className={cn(
          'z-50 max-w-100 min-w-40 rounded-xl border-0 bg-glass p-2 text-fg shadow-[0_0_0_1px_var(--color-overlay)] backdrop-blur-2xl outline-none',
          className,
        )}
      />
    </PopoverPrimitive.Portal>
  )
})
