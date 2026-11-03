'use client'

import { cn } from '@/lib/cn'

import { useSelectionStore } from '../selection/selection-store'
import type { StatusView } from './status-view'
import { StatusPill } from './StatusPill'

interface FailedPillProps {
  view: StatusView
}

const HOVER_HIDE_CLASSES =
  'group-hover/card:pointer-events-none group-hover/card:opacity-0 group-has-[:focus-visible]/card:pointer-events-none group-has-[:focus-visible]/card:opacity-0'

/** Corner pill, hidden on hover or while selecting so the checkbox can take its place. */
export function FailedPill(props: FailedPillProps) {
  const { view } = props

  const isSelecting = useSelectionStore((state) => {
    return state.ids.size > 0
  })

  const hideClasses = isSelecting ? 'pointer-events-none opacity-0' : HOVER_HIDE_CLASSES

  return (
    <div className="absolute top-4 left-4 z-30 @max-[239px]:top-3 @max-[239px]:left-3">
      <div className={cn('transition-opacity duration-150', hideClasses)}>
        <StatusPill label={view.label} help={view.help} tone={view.tone} />
      </div>
    </div>
  )
}
