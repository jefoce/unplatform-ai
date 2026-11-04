import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'
import type { ReactNode } from 'react'

import { usePointerCloseFocus } from '@/ui/use-pointer-close-focus'

import { MoreMenuRow } from './MoreMenuRow'

interface MenuRow {
  key: string
  label: string
  icon: ReactNode
  onSelect: () => void
  isDisabled?: boolean
  isDestructive?: boolean
}

interface MenuSeparator {
  key: string
  separator: true
}

export type MenuEntry = MenuRow | MenuSeparator

interface MoreMenuContentProps {
  entries: MenuEntry[]
}

/** Menu items for one record or image output, in display order. */
export function MoreMenuContent(props: MoreMenuContentProps) {
  const { handlePointerDown, handleKeyDown, handleCloseAutoFocus } = usePointerCloseFocus()

  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align="end"
        sideOffset={6}
        onPointerDown={handlePointerDown}
        onPointerDownOutside={handlePointerDown}
        onKeyDown={handleKeyDown}
        onCloseAutoFocus={handleCloseAutoFocus}
        className="z-50 min-w-52 rounded-xl bg-page-2 p-2 shadow-[0_0_0_1px_var(--color-hover)]"
      >
        {props.entries.map((entry) => {
          if ('separator' in entry) {
            return (
              <DropdownMenuPrimitive.Separator key={entry.key} className="my-1 h-px bg-divider" />
            )
          }

          return (
            <MoreMenuRow
              key={entry.key}
              icon={entry.icon}
              disabled={entry.isDisabled}
              destructive={entry.isDestructive}
              onSelect={entry.onSelect}
            >
              {entry.label}
            </MoreMenuRow>
          )
        })}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  )
}
