import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

const MENU_ITEM_CLASSES =
  'flex h-9 cursor-pointer select-none items-center gap-2 rounded-lg px-2 text-sm font-medium leading-5 tracking-[0.00625rem] outline-none data-[highlighted]:bg-hover'

interface MoreMenuRowProps {
  children: ReactNode
  icon: ReactNode
  onSelect: () => void
  disabled?: boolean
  destructive?: boolean
}

/** One item in the record actions menu. */
export function MoreMenuRow(props: MoreMenuRowProps) {
  const {
    children,
    icon,
    onSelect: handleSelect,
    disabled: isDisabled,
    destructive: isDestructive = false,
  } = props

  return (
    <DropdownMenuPrimitive.Item
      disabled={isDisabled}
      onSelect={handleSelect}
      className={cn(
        MENU_ITEM_CLASSES,
        isDestructive ? 'text-danger data-[highlighted]:bg-danger/10' : 'text-fg',
      )}
    >
      <span
        className={cn('flex shrink-0 items-center', isDestructive ? 'text-danger' : 'text-fg-2')}
      >
        {icon}
      </span>
      {children}
    </DropdownMenuPrimitive.Item>
  )
}
