import { isNil } from 'lodash-es'

import type { CatalogEntry } from '@/core/catalog'

import { type PickerGroup, type PickerRow, selectedTitle } from './picker-groups'
import { presetTitleOf } from './preset-title'

interface FallbackRowParams {
  selectedId: string
  entry: CatalogEntry | null
}

interface PopoverSideParams {
  isBar: boolean
  isWide: boolean
}

export function fallbackRow(params: FallbackRowParams): PickerRow {
  const { selectedId, entry } = params
  const source = entry?.source

  return {
    id: selectedId,
    title: fallbackTitle(selectedId, entry),
    icon: 'sparkles',
    description: '',
    priceText: '',
    kind: source?.kind,
    badge: source?.badge,
    status: entry?.status,
    reason: entry?.reason,
    isCustom: source?.kind === 'custom',
  }
}

function fallbackTitle(selectedId: string, entry: CatalogEntry | null): string {
  const presetTitle = entry?.preset?.title

  if (!isNil(presetTitle)) {
    return presetTitle
  }

  return presetTitleOf(selectedId) ?? selectedTitle(selectedId)
}

export function currentRow(groups: readonly PickerGroup[], selectedId: string): PickerRow | null {
  for (const group of groups) {
    const found = group.rows.find((row) => {
      return row.id === selectedId
    })

    if (found) {
      return found
    }
  }

  return null
}

export function searchGroups(groups: readonly PickerGroup[], query: string): PickerGroup[] {
  const needle = query.trim().toLowerCase()

  if (needle === '') {
    return [...groups]
  }

  return groups.map((group) => {
    const rows = group.rows.filter((row) => {
      const haystack = `${row.title} ${row.description}`.toLowerCase()

      return haystack.includes(needle)
    })

    return { ...group, rows }
  })
}

export function visibleGroups(groups: readonly PickerGroup[]): PickerGroup[] {
  return groups.filter((group) => {
    return group.rows.length > 0
  })
}

export function popoverSide(params: PopoverSideParams): 'top' | 'right' | 'bottom' {
  const { isBar, isWide } = params

  if (isBar) {
    return 'top'
  }

  if (isWide) {
    return 'right'
  }

  return 'bottom'
}

export function contentWidth(isBar: boolean): string {
  if (isBar) {
    return 'w-96'
  }

  return 'w-80'
}
