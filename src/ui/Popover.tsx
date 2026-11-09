'use client'

import { forwardRef } from 'react'
import { isFunction, isNil } from 'lodash-es'
import { Popover as PopoverPrimitive } from 'radix-ui'

import { cn } from '@/lib/cn'

import { usePointerCloseFocus } from './use-pointer-close-focus'

export const Popover = PopoverPrimitive.Root
export const PopoverClose = PopoverPrimitive.Close
export const PopoverTrigger = PopoverPrimitive.Trigger

/** Floating panel anchored to a trigger. */
export const PopoverContent = forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(function PopoverContent(props, ref) {
  const { className, sideOffset = 8, align = 'center', collisionPadding = 8, ...rest } = props

  const { handlePointerDown, handleKeyDown, handleCloseAutoFocus } = usePointerCloseFocus()

  const handleOpenAutoFocus = (event: Event): void => {
    const content = event.currentTarget

    if (content instanceof HTMLElement) {
      const selected = content.querySelector('[data-selected="true"]')

      if (!isNil(selected)) {
        requestAnimationFrame(() => {
          if (isFunction(selected.scrollIntoView)) {
            selected.scrollIntoView({ block: 'nearest' })
          }
        })
      }
    }

    props.onOpenAutoFocus?.(event)
  }

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        collisionPadding={collisionPadding}
        onPointerDown={handlePointerDown}
        onPointerDownOutside={handlePointerDown}
        onKeyDown={handleKeyDown}
        onCloseAutoFocus={handleCloseAutoFocus}
        {...rest}
        onOpenAutoFocus={handleOpenAutoFocus}
        className={cn(
          'z-50 max-w-100 min-w-40 rounded-xl border-0 bg-glass p-2 text-fg shadow-[0_0_0_1px_var(--color-overlay)] backdrop-blur-2xl outline-none linux:bg-glass',
          className,
        )}
      />
    </PopoverPrimitive.Portal>
  )
})
