import { isNil } from 'lodash-es'

import type { CatalogEntry } from '@/core/catalog'
import type { PickerModel } from '@/core/feed/picker-model'
import { minDuration } from '@/core/presets'
import type { VideoPreset } from '@/core/presets/video/types'
import { formatRate } from '@/core/pricing/format'
import { pricePerSec } from '@/core/pricing/quote'
import type { Dict } from '@/core/utility-types'

/** Resolution range shown in the picker row. */
export function videoQuality(preset: VideoPreset): string {
  const [first] = preset.resolutions
  const last = preset.resolutions.at(-1)

  if (isNil(first) || isNil(last)) {
    return ''
  }

  if (first === last) {
    return first
  }

  return `${first}-${last}`
}

export function videoDuration(preset: VideoPreset): string {
  return `${minDuration(preset)}-${preset.duration.max}s`
}

/** Cheapest effective per-second rate across the model's resolutions. */
export function videoRate(preset: VideoPreset, skus?: Dict<number>): number | null {
  const ctx = {
    aspect: preset.defaultAspectRatio,
    audio: preset.audio.default,
    hasVideoInput: false,
  }

  const rates = preset.resolutions
    .map((resolution) => {
      return pricePerSec({ preset, ctx: { ...ctx, resolution }, skus })
    })
    .filter((rate): rate is number => {
      return !isNil(rate)
    })

  if (rates.length > 0) {
    return Math.min(...rates)
  }

  return null
}

function description(preset: VideoPreset): string {
  const parts = [videoQuality(preset), videoDuration(preset)]

  if (preset.audio.supported) {
    parts.push('Audio')
  }

  return parts.filter(Boolean).join(' \u00b7 ')
}

function priceText(preset: VideoPreset, entry: CatalogEntry | null): string {
  const rate = videoRate(preset, entry?.pricing?.skus)

  if (isNil(rate)) {
    return ''
  }

  return `from ${formatRate(rate)}`
}

/** Picker view for a video preset, priced from the live catalog entry when present. */
export function videoPickerModel(preset: VideoPreset, entry: CatalogEntry | null): PickerModel {
  return {
    id: preset.id,
    title: preset.title,
    icon: preset.icon,
    description: description(preset),
    priceText: priceText(preset, entry),
  }
}
