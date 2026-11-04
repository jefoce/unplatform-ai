'use client'

import { isNil } from 'lodash-es'
import { Check } from 'lucide-react'
import type { KeyboardEvent, ReactNode } from 'react'

import { isOneOf } from '@/core/guards'
import { cn } from '@/lib/cn'

const ARROW_KEYS = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'] as const

interface CheckItemProps {
  label: string
  value: string
  isChecked: boolean
  onSelect: (value: string) => void
  icon?: ReactNode
  detail?: string | null
  className?: string
}

/** One radio row with an optional icon, detail line and check. */
export function CheckItem(props: CheckItemProps) {
  const { label, value, isChecked, icon, detail, className } = props
  const checkClass = cn('shrink-0 text-accent', !isChecked && 'invisible')
  const tabIndex = isChecked ? 0 : -1

  const handleClick = () => {
    props.onSelect(value)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!isOneOf(ARROW_KEYS, event.key)) {
      return
    }

    event.preventDefault()
    const group = event.currentTarget.closest('[role="radiogroup"]')

    if (isNil(group)) {
      return
    }

    const radios = [...group.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
    const index = radios.indexOf(event.currentTarget)

    if (index === -1) {
      return
    }

    const isPrevious = event.key === 'ArrowUp' || event.key === 'ArrowLeft'
    const step = isPrevious ? -1 : 1
    const next = radios[(index + step + radios.length) % radios.length]

    if (isNil(next)) {
      return
    }

    next.focus()
    next.click()
  }

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isChecked}
      tabIndex={tabIndex}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex min-h-8 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/10 focus-visible:bg-hover',
        isChecked && 'bg-white/6',
        className,
      )}
    >
      {!isNil(icon) && (
        <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm/5">{label}</span>
        {!isNil(detail) && <span className="text-xxs text-fg-2">{detail}</span>}
      </span>
      <Check size={14} aria-hidden className={checkClass} />
    </button>
  )
}
