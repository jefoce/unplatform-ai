import { type HistoryItem, isVideoItem } from '@/lib/feed/output-items'

import { HistoryRow } from './HistoryRow'

interface HistoryListProps {
  items: HistoryItem[]
}

/** Full-width rows, one per video generation. */
export function HistoryList(props: HistoryListProps) {
  const { items } = props

  return (
    <div className="flex flex-col">
      {items.filter(isVideoItem).map((item) => {
        return (
          <div key={item.id} id={`history-item-${item.id}`} className="mb-5 pt-1 pl-1">
            <HistoryRow item={item} />
          </div>
        )
      })}
    </div>
  )
}
