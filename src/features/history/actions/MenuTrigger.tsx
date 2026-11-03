'use client'

import { MoreHorizontal } from 'lucide-react'
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'

interface MenuTriggerProps {
  className?: string
}

/** Round "More actions" button shared by the record and image menus. */
export function MenuTrigger(props: MenuTriggerProps) {
  return (
    <DropdownMenuPrimitive.Trigger asChild>
      <button type="button" aria-label="More actions" data-card-menu className={props.className}>
        <MoreHorizontal size={16} aria-hidden />
      </button>
    </DropdownMenuPrimitive.Trigger>
  )
}
