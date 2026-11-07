import type { CatalogEntry } from '@/core/catalog'

import type { PickerRow } from './picker-groups'

export interface ModelRowProps {
  model: PickerRow
  selected: boolean
  onSelect: (id: string) => void
}

/** True when the catalog reports the model cannot run right now. */
export function isBlockedEntry(entry: CatalogEntry | null): boolean {
  return entry?.status === 'missing' || entry?.status === 'no_provider'
}
