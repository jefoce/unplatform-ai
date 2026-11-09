import { isNil } from 'lodash-es'

import type { CatalogEntry, ModelStatus } from '@/core/catalog'
import type { PickerModel } from '@/core/feed/picker-model'
import { findPreset, minDuration } from '@/core/presets'
import { primaryBinding } from '@/core/presets/common/bindings'
import { resolutionRange } from '@/core/presets/common/display'
import { findImagePreset } from '@/core/presets/image'
import type { ImagePreset } from '@/core/presets/image/types'
import type { VideoPreset } from '@/core/presets/video/types'
import { formatUsd } from '@/core/pricing/format'
import { showPrice } from '@/core/pricing/visibility'
import type { ProviderKindId } from '@/core/providers/types'

export type PickerKind = 'video' | 'image'

export interface PickerRow extends PickerModel {
  kind?: ProviderKindId
  badge?: string | null
  status?: ModelStatus
  reason?: string | null
  isCustom?: boolean
  resolutionText: string | null
  durationText: string | null
  referenceCount: number
  hasAudio: boolean
  mediaKind: PickerKind
}

export interface PickerGroup {
  kind: ProviderKindId
  title: string
  rows: PickerRow[]
}

const GROUP_TITLES: Record<ProviderKindId, string> = {
  openrouter: 'OpenRouter',
  custom: 'ComfyUI',
}

function staticRow(model: PickerModel, kind: PickerKind): PickerRow {
  return {
    ...model,
    kind: 'openrouter',
    badge: null,
    status: 'available',
    reason: null,
    isCustom: false,
    resolutionText: null,
    durationText: null,
    referenceCount: 0,
    hasAudio: false,
    mediaKind: kind,
  }
}

function isVideoPreset(preset: VideoPreset | ImagePreset): preset is VideoPreset {
  return 'duration' in preset
}

function customPrice(entry: CatalogEntry, preset: VideoPreset | ImagePreset): string {
  const usd = entry.pricing?.skus.per_run ?? primaryBinding(preset).pricing.fallback.per_run ?? 0

  if (!showPrice({ local: true }, usd)) {
    return ''
  }

  const unit = entry.source.priceUnit === 'second' ? 's' : 'run'

  return `${formatUsd(usd)} / ${unit}`
}

/** Preset description for both kinds, empty when the preset has none. */
function descriptionOf(preset: VideoPreset | ImagePreset): string {
  return preset.description ?? ''
}

interface CustomRowParams {
  entry: CatalogEntry
  preset: VideoPreset | ImagePreset
  aspect: string | undefined
}

function customRow(params: CustomRowParams): PickerRow {
  const { entry, preset, aspect } = params
  const isVideo = isVideoPreset(preset)
  let resolutionText: string | null = null
  let durationText: string | null = null
  let referenceCount = 0
  let hasAudio = false
  let mediaKind: PickerKind = 'image'

  if (isVideo) {
    resolutionText = resolutionRange(preset, { aspect: aspect ?? preset.defaultAspectRatio })
    durationText = `${minDuration(preset)}-${preset.duration.max} s`
    referenceCount = preset.references.image + preset.references.video + preset.references.audio
    hasAudio = preset.audio.supported
    mediaKind = 'video'
  }

  return {
    id: preset.id,
    title: preset.title,
    icon: preset.icon,
    description: descriptionOf(preset),
    priceText: customPrice(entry, preset),
    kind: 'custom',
    badge: entry.source.badge,
    status: entry.status,
    reason: entry.reason,
    isCustom: true,
    resolutionText,
    durationText,
    referenceCount,
    hasAudio,
    mediaKind,
  }
}

function badgeOrder(row: PickerRow): string {
  return row.badge ?? ''
}

function byBadgeThenTitle(a: PickerRow, b: PickerRow): number {
  const badgeOrdered = badgeOrder(a).localeCompare(badgeOrder(b))

  if (badgeOrdered !== 0) {
    return badgeOrdered
  }

  return a.title.localeCompare(b.title)
}

interface CustomRowsParams {
  entries: readonly CatalogEntry[]
  kind: PickerKind
  aspect: string | undefined
}

/** Custom entries for one tab. Missing models are hidden but stay in the trigger. */
function customRows(params: CustomRowsParams): PickerRow[] {
  const { entries, kind, aspect } = params

  const rows: PickerRow[] = []

  for (const entry of entries) {
    const preset = entry.preset

    if (isNil(preset) || entry.source.kind !== 'custom') {
      continue
    }

    if (isVideoPreset(preset) !== (kind === 'video')) {
      continue
    }

    if (entry.status === 'missing') {
      continue
    }

    rows.push(customRow({ entry, preset, aspect }))
  }

  return rows.sort(byBadgeThenTitle)
}

interface PickerGroupsParams {
  models: readonly PickerModel[]
  entries: readonly CatalogEntry[]
  kind: PickerKind
  aspect?: string
}

/** OpenRouter first, then ComfyUI rows sorted by badge and title. */
export function pickerGroups(params: PickerGroupsParams): PickerGroup[] {
  const { models, entries, kind, aspect } = params

  const openrouter = models.map((model) => {
    return staticRow(model, kind)
  })

  const custom = customRows({ entries, kind, aspect })

  if (custom.length === 0) {
    return [{ kind: 'openrouter', title: GROUP_TITLES.openrouter, rows: openrouter }]
  }

  return [
    { kind: 'openrouter', title: GROUP_TITLES.openrouter, rows: openrouter },
    { kind: 'custom', title: GROUP_TITLES.custom, rows: custom },
  ]
}

/** Static or runtime title for a preset id, used when the row is not listed. */
export function selectedTitle(selectedId: string): string {
  const preset = findPreset(selectedId) ?? findImagePreset(selectedId)

  return preset?.title ?? selectedId
}
