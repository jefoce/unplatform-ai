import type { CatalogEntry } from '@/core/catalog'
import type { PickerModel } from '@/core/feed/picker-model'

export interface ModelRowProps {
  model: PickerModel
  selected: boolean
  onSelect: (id: string) => void
}

/** True when the catalog reports the model cannot run right now. */
export function isBlockedEntry(entry: CatalogEntry | null): boolean {
  return entry?.status === 'missing' || entry?.status === 'no_provider'
}
