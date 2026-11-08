import { isEmpty } from 'lodash-es'

import type { CatalogEntry } from '@/core/catalog'

import { ModelRow } from './ModelRow'
import type { PickerGroup } from './picker-groups'

interface ModelGroupListProps {
  groups: readonly PickerGroup[]
  entries: ReadonlyMap<string, CatalogEntry>
  selectedId: string
  onSelect: (id: string) => void
}

/** Provider sections with their model rows. */
export function ModelGroupList(props: ModelGroupListProps) {
  const { groups, entries, selectedId } = props

  if (isEmpty(groups)) {
    return <p className="p-3 text-center text-xs text-fg-2">No models</p>
  }

  return (
    <>
      {groups.map((group) => {
        return (
          <div key={group.kind} className="space-y-1">
            <p className="px-2 pt-1 text-xs font-semibold text-fg-2">{group.title}</p>
            {group.rows.map((row) => {
              return (
                <ModelRow
                  key={row.id}
                  model={row}
                  entry={entries.get(row.id) ?? null}
                  selected={row.id === selectedId}
                  onSelect={props.onSelect}
                />
              )
            })}
          </div>
        )
      })}
    </>
  )
}
