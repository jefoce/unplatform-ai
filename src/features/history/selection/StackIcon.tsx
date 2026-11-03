import { AlertCircle, Image as ImageIcon, Video } from 'lucide-react'

import type { GridItemStatus } from '@/core/feed/grid-item'
import type { HistoryItem } from '@/lib/feed/output-items'
import { Spinner } from '@/ui/Spinner'

const ACTIVE: readonly GridItemStatus[] = ['submitting', 'saving', 'pending', 'in_progress']

interface StackIconProps {
  item: HistoryItem
}

/** Fallback icon inside a selection stack thumb without a poster. */
export function StackIcon(props: StackIconProps) {
  const { item } = props

  if (ACTIVE.includes(item.status)) {
    return <Spinner size={12} tone="muted" />
  }

  if (item.status !== 'completed') {
    return <AlertCircle size={12} aria-hidden />
  }

  if (item.recordKind === 'image') {
    return <ImageIcon size={12} aria-hidden />
  }

  return <Video size={12} aria-hidden />
}
