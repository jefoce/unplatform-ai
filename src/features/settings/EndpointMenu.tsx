'use client'

import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/ui/Popover'

const MENU_ITEM_CLASSES =
  'flex w-full items-center rounded-lg px-2 py-1.5 text-left text-xs text-fg hover:bg-hover'

interface EndpointMenuProps {
  isEnabled: boolean
  isRemoved: boolean
  onRetest: () => void
  onToggleEnabled: () => void
  onRemove: () => void
}

/** Row menu: retest, enable or disable, remove. */
export function EndpointMenu(props: EndpointMenuProps) {
  const { isEnabled, isRemoved } = props
  const [isOpen, setIsOpen] = useState(false)

  const handleRetest = () => {
    setIsOpen(false)
    props.onRetest()
  }

  const handleToggleEnabled = () => {
    setIsOpen(false)
    props.onToggleEnabled()
  }

  const handleRemove = () => {
    setIsOpen(false)
    props.onRemove()
  }

  const enabledLabel = isEnabled ? 'Disable' : 'Enable'
  const removeLabel = isRemoved ? 'Keep' : 'Delete'

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Endpoint menu"
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-fg-2 hover:bg-hover hover:text-fg"
        >
          <MoreHorizontal size={15} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-40 space-y-0.5">
        <button type="button" className={MENU_ITEM_CLASSES} onClick={handleRetest}>
          Retest
        </button>
        <button type="button" className={MENU_ITEM_CLASSES} onClick={handleToggleEnabled}>
          {enabledLabel}
        </button>
        <button type="button" className={MENU_ITEM_CLASSES} onClick={handleRemove}>
          {removeLabel}
        </button>
      </PopoverContent>
    </Popover>
  )
}
