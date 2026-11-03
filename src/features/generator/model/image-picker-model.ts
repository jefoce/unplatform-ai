import { isNil } from 'lodash-es'

import type { PickerModel } from '@/core/feed/picker-model'
import { primaryBinding } from '@/core/presets/common/bindings'
import type { ImagePreset } from '@/core/presets/image/types'
import { formatUsd } from '@/core/pricing/format'
import { imageQuoteContext, quoteWithFallback } from '@/core/pricing/quote'
import type { SkuTable } from '@/core/pricing/types'

/** Cheapest estimate across the preset's option lists at count 1 and no references. */
function imageRate(preset: ImagePreset, skus?: SkuTable): number | null {
  const resolutions = preset.resolutions?.map((option) => {
    return option.value
  }) ?? [preset.defaultResolution]

  const qualities = preset.qualities?.map((option) => {
    return option.value
  }) ?? [preset.defaultQuality]

  const binding = primaryBinding(preset)

  const prices = resolutions.flatMap((resolution) => {
    return qualities.map((quality) => {
      const ctx = imageQuoteContext(preset, {
        count: 1,
        aspectRatio: preset.defaultAspectRatio,
        resolution,
        quality,
        background: preset.defaultBackground,
        references: [],
        promptChars: 0,
      })

      const result = quoteWithFallback({ preset, binding, ctx, skus })

      return result?.total ?? null
    })
  })

  const priced = prices.filter((price): price is number => {
    return !isNil(price)
  })

  if (priced.length === 0) {
    return null
  }

  return Math.min(...priced)
}

/** Picker row for an image preset, priced from the cheapest option. */
export function imagePickerModel(preset: ImagePreset, skus?: SkuTable): PickerModel {
  const rate = imageRate(preset, skus)
  let priceText = ''

  if (!isNil(rate)) {
    priceText = `from ${formatUsd(rate)}`
  }

  return {
    id: preset.id,
    title: preset.title,
    icon: preset.icon,
    description: preset.description,
    priceText,
  }
}
