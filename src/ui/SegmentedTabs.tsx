'use client'

import { cn } from '@/lib/cn'

import { SegmentedTab, type SegmentedTabOption } from './SegmentedTab'

interface SegmentedTabsProps {
  options: SegmentedTabOption[]
  value: string
  onValueChange: (value: string) => void
  className?: string
  size?: 'sm' | 'md'
}

/** Controlled segmented tab control. */
export function SegmentedTabs(props: SegmentedTabsProps) {
  const { options, value, className, size = 'md' } = props
  const sizeClass = size === 'md' ? 'h-10 text-sm' : 'h-8 text-xs'

  return (
    <div
      role="tablist"
      className={cn('grid gap-0 rounded-xl bg-surface', className)}
      style={{ gridTemplateColumns: `repeat(${Math.max(options.length, 1)}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        return (
          <SegmentedTab
            key={option.value}
            option={option}
            isActive={option.value === value}
            sizeClass={sizeClass}
            onValueChange={props.onValueChange}
          />
        )
      })}
    </div>
  )
}
