'use client'

import { type ReactNode, useState } from 'react'
import { isNil } from 'lodash-es'

import { isOneOf } from '@/core/guards'
import { cn } from '@/lib/cn'

import { CheckItem } from './CheckItem'
import { Chip } from './Chip'
import { Popover, PopoverContent, PopoverTrigger } from './Popover'
import { Tooltip } from './Tooltip'

interface OptionPopoverProps<T extends string> {
  label: string
  options: readonly T[]
  labels?: Readonly<Partial<Record<T, string>>>
  value: T
  onValueChange: (value: T) => void
  icon?: ReactNode
  optionIcon?: (value: T) => ReactNode
  optionDetail?: (value: T) => string | null
  closeOnPick?: boolean
  disabled?: boolean
  className?: string
  contentClassName?: string
}

/** Single-choice option menu with a header, optional icons and details. */
export function OptionPopover<T extends string>(props: OptionPopoverProps<T>) {
  const {
    label,
    options,
    labels,
    value,
    icon,
    disabled: isDisabled = false,
    className,
    contentClassName,
  } = props

  const [isOpen, setIsOpen] = useState(false)
  const current = labels?.[value] ?? value

  const handleSelect = (next: string) => {
    if (!isOneOf(options, next)) {
      return
    }

    props.onValueChange(next)

    if (props.closeOnPick !== false) {
      setIsOpen(false)
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip content={label}>
        <PopoverTrigger asChild>
          <Chip
            size="bar"
            aria-label={`${label}: ${current}`}
            disabled={isDisabled}
            className={className}
          >
            {!isNil(icon) && (
              <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
            )}
            {current}
          </Chip>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent
        role="radiogroup"
        aria-label={label}
        align="start"
        className={cn('w-52 space-y-1', contentClassName)}
      >
        <p className="px-2 py-1 text-xxs font-medium text-fg-2">{label}</p>
        {options.map((option) => {
          return (
            <CheckItem
              key={option}
              value={option}
              label={labels?.[option] ?? option}
              isChecked={option === value}
              onSelect={handleSelect}
              icon={props.optionIcon?.(option)}
              detail={props.optionDetail?.(option)}
            />
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
