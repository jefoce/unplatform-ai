'use client'

import { type MouseEvent } from 'react'

import { DETAILS_MIN_WIDTH, ROW_MIN_HEIGHT } from '@/core/constants'
import { isOwnEvent } from '@/lib/events'
import type { VideoGridItem } from '@/lib/feed/output-items'

import { DetailsPanel } from '../details/DetailsPanel'
import { useSelectionItem } from '../selection/use-selection-item'
import { HistoryRowMedia } from './HistoryRowMedia'

interface HistoryRowProps {
  item: VideoGridItem
}

/** List row: 16:9 media left, details right, both scale with the row width. */
export function HistoryRow(props: HistoryRowProps) {
  const { item } = props
  const isCompleted = item.status === 'completed'

  const { selected: isSelected, selecting: isSelecting, select } = useSelectionItem(item.id)

  const handleSelect = (event: MouseEvent<HTMLDivElement>) => {
    const isRowClick =
      isOwnEvent(event) && !(event.target as HTMLElement).closest('button, a, input')

    if (!isRowClick) {
      return
    }

    if (event.shiftKey && item.canSelect) {
      select(true)

      return
    }

    if (isSelecting && item.canSelect) {
      select(false)
    }
  }

  return (
    <div
      className="group/card flex w-full items-stretch gap-3"
      style={{
        minHeight: ROW_MIN_HEIGHT,
        contentVisibility: 'auto',
        containIntrinsicSize: `auto ${ROW_MIN_HEIGHT}px`,
      }}
    >
      <HistoryRowMedia
        item={item}
        isCompleted={isCompleted}
        isSelected={isSelected}
        isSelecting={isSelecting}
        onSelect={handleSelect}
      />

      <div
        className="min-h-0 flex-1 self-stretch overflow-hidden"
        style={{ minWidth: DETAILS_MIN_WIDTH }}
      >
        <DetailsPanel item={item} />
      </div>
    </div>
  )
}
