import type { GenerationRecord } from '@/core/types'

import { HistoryRow } from './HistoryRow'

interface HistoryListProps {
  records: GenerationRecord[]
}

/** Full-width rows, one per generation. */
export function HistoryList(props: HistoryListProps) {
  const { records } = props

  return (
    <div className="flex flex-col">
      {records.map((record) => (
        <div key={record.id} id={`history-item-${record.id}`} className="mb-5 pt-1 pl-1">
          <HistoryRow record={record} />
        </div>
      ))}
    </div>
  )
}
