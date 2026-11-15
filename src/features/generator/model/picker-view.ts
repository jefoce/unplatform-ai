import { isEmpty, isNil } from 'lodash-es'

import type { CatalogEntry } from '@/core/catalog'
import type { PresetIcon } from '@/core/presets/common/icon'
import type { ImagePreset } from '@/core/presets/image/types'
import type { VideoPreset } from '@/core/presets/video/types'

import { type PickerGroup, type PickerKind, type PickerRow, selectedTitle } from './picker-groups'
import { presetTitleOf } from './preset-title'

interface FallbackRowParams {
  selectedId: string
  entry: CatalogEntry | null
  savedTitle: string | null
  savedBadge: string | null
  savedIcon: PresetIcon
}

export interface FallbackTitleParams {
  selectedId: string
  entry: CatalogEntry | null
  savedTitle: string | null
}

interface PopoverSideParams {
  isBar: boolean
  isWide: boolean
}

function fallbackMediaKind(preset: VideoPreset | ImagePreset | undefined): PickerKind {
  if (isNil(preset)) {
    return 'video'
  }

  if ('duration' in preset) {
    return 'video'
  }

  return 'image'
}

// eslint-disable-next-line complexity -- the row carries every fallback default
export function fallbackRow(params: FallbackRowParams): PickerRow {
  const { selectedId, entry, savedTitle, savedBadge, savedIcon } = params
  const source = entry?.source
  const title = fallbackTitle({ selectedId, entry, savedTitle })
  const badge = savedBadge ?? source?.badge ?? null

  return {
    id: selectedId,
    title: title ?? selectedTitle(selectedId) ?? '',
    icon: savedIcon,
    description: '',
    priceText: '',
    kind: source?.kind,
    badge,
    status: entry?.status,
    reason: entry?.reason,
    isCustom: source?.kind === 'custom',
    resolutionText: null,
    durationText: null,
    hasAudio: false,
    mediaKind: fallbackMediaKind(entry?.preset),
  }
}

/** Catalog title, snapshot title, or the saved draft title. Never the raw id. */
export function fallbackTitle(params: FallbackTitleParams): string | null {
  const { selectedId, entry, savedTitle } = params
  const presetTitle = entry?.preset?.title

  if (!isNil(presetTitle) && !isEmpty(presetTitle)) {
    return presetTitle
  }

  const remembered = presetTitleOf(selectedId)

  if (!isNil(remembered) && !isEmpty(remembered)) {
    return remembered
  }

  if (!isNil(savedTitle) && !isEmpty(savedTitle)) {
    return savedTitle
  }

  return null
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
