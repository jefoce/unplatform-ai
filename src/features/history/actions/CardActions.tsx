'use client'

import { type MouseEvent } from 'react'
import { Download } from 'lucide-react'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import { cn } from '@/lib/cn'

import { HeartButton } from './HeartButton'
import { MoreMenu } from './MoreMenu'
import { saveRecordVideo } from './record-actions'

const ROUND_BUTTON_CLASSES =
  'inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70'

const HOVER_REVEAL_CLASSES =
  'pointer-events-none opacity-0 transition-opacity group-hover/card:pointer-events-auto group-hover/card:opacity-100 group-has-[:focus-visible]/card:pointer-events-auto group-has-[:focus-visible]/card:opacity-100 group-has-[[data-card-menu][data-state=open]]/card:pointer-events-auto group-has-[[data-card-menu][data-state=open]]/card:opacity-100'

interface CardActionsProps {
  record: GenerationRecord
  className?: string

  /** Keep the liked heart visible without hover, for the list stack. */
  pinHeart?: boolean
}

/** Heart, download and menu stack shared by the list row and grid tile. */
export function CardActions(props: CardActionsProps) {
  const { record, className, pinHeart: isPinHeart = false } = props
  const isPinned = isPinHeart && record.favorite

  const handleDownload = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    void saveRecordVideo(record)
  }

  return (
    <div className={cn('absolute right-3 flex flex-col gap-1.5', className)}>
      <HeartButton record={record} className={cn(!isPinned && HOVER_REVEAL_CLASSES)} />
      <button
        type="button"
        aria-label="Download"
        onClick={handleDownload}
        className={cn(ROUND_BUTTON_CLASSES, HOVER_REVEAL_CLASSES)}
      >
        <Download size={15} aria-hidden />
      </button>
      <MoreMenu record={record} className={HOVER_REVEAL_CLASSES} />
    </div>
  )
}
