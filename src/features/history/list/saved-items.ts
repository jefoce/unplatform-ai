import type { HistoryItem } from '@/lib/feed/output-items'

/** Viewer rows: a saved image output or a completed video only. */
export function isSavedItem(item: HistoryItem): boolean {
  if (item.recordKind === 'video') {
    return item.status === 'completed'
  }

  return item.output?.status === 'saved'
}
