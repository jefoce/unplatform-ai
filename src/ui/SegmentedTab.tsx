'use client'

import { useCallback } from 'react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

export interface SegmentedTabOption {
  value: string
  label: ReactNode
  disabled?: boolean
}

interface SegmentedTabProps {
  option: SegmentedTabOption
  isActive: boolean
  sizeClass: string
  onValueChange: (value: string) => void
}

/** One tab button in a segmented control. */
export function SegmentedTab(props: SegmentedTabProps) {
  const { option, isActive, sizeClass, onValueChange } = props
  const handleSelect = useCallback(() => onValueChange(option.value), [onValueChange, option.value])

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      disabled={option.disabled}
      onClick={handleSelect}
      className={cn(
        'relative inline-flex items-center justify-center rounded-control font-semibold transition',
        'disabled:pointer-events-none disabled:opacity-40',
        sizeClass,
        isActive ? 'text-fg' : 'text-fg-2 hover:text-fg',
      )}
    >
      {isActive && <span className="absolute inset-0.5 rounded-control bg-white/10" aria-hidden />}
      <span className="relative">{option.label}</span>
    </button>
  )
}
