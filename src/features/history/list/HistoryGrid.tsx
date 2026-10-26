'use client'

import type { GenerationRecord } from '@/core/schemas/generation-record'

import { HistoryTile } from './HistoryTile'
import { useHistoryViewStore, zoomToGridColumns } from './view-store'

interface HistoryGridProps {
  records: GenerationRecord[]
  onOpen: (record: GenerationRecord) => void
}

/** Fixed column count per zoom, tiles stay square and fill their column. */
export function HistoryGrid(props: HistoryGridProps) {
  const { records } = props

  const zoom = useHistoryViewStore((state) => {
    return state.zoom
  })

  const columns = zoomToGridColumns(zoom)

  return (
    <div
      className="grid gap-3 pt-1 pl-1"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {records.map((record) => {
        return (
          <div key={record.id} id={`history-item-${record.id}`}>
            <HistoryTile record={record} onOpen={props.onOpen} />
          </div>
        )
      })}
    </div>
  )
}
