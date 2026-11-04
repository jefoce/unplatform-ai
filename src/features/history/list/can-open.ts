import { type HistoryItem, isVideoItem } from '@/lib/feed/output-items'

/** Videos open at any status, images only once the output is saved. */
export function canOpenItem(item: HistoryItem): boolean {
  if (isVideoItem(item)) {
    return true
  }

  return item.output?.status === 'saved'
}
