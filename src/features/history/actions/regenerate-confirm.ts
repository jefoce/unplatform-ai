import { isNil } from 'lodash-es'

import { findPreset } from '@/core/presets'
import { primaryBinding } from '@/core/presets/common/bindings'
import { findImagePreset } from '@/core/presets/image'
import { formatUsd } from '@/core/pricing/format'
import { imageQuoteContext, quote, type VideoQuoteContext } from '@/core/pricing/quote'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { ImageRecord } from '@/core/schemas/image-record'
import type { ImageGridItem } from '@/lib/feed/output-items'

function imageCountText(count: number): string {
  if (count === 1) {
    return '1 image'
  }

  return `${count} images`
}

/** Fresh fallback quote for an image input, so a failed run prices the new one. */
function imageQuoteUsd(record: ImageRecord): number {
  const preset = findImagePreset(record.input.presetId)

  if (isNil(preset)) {
    return record.cost.estimatedUsd
  }

  const binding = primaryBinding(preset)

  const ctx = imageQuoteContext(preset, {
    ...record.input,
    promptChars: record.input.prompt.length,
  })

  const result = quote({ preset, binding, ctx })

  return result?.total ?? record.cost.estimatedUsd
}

/** True when a stored reference is a video, which the price bills by second. */
function hasVideoReference(record: GenerationRecord): boolean {
  const { input } = record

  if (input.tab !== 'references') {
    return false
  }

  return input.references.some((id) => {
    return record.inputsSnapshot[id]?.kind === 'video'
  })
}

/** Fresh fallback quote for a video input, ignoring the stored actual cost. */
function videoQuoteUsd(record: GenerationRecord): number {
  const preset = findPreset(record.input.presetId)

  if (isNil(preset)) {
    return record.cost.estimatedUsd
  }

  const ctx: VideoQuoteContext = {
    kind: 'video',
    resolution: record.input.resolution,
    aspect: record.input.aspectRatio,
    audio: record.input.audio,
    hasVideoInput: hasVideoReference(record),
    duration: record.input.duration,
    referenceSeconds: record.cost.referenceSeconds ?? 0,
  }

  const result = quote({ preset, binding: primaryBinding(preset), ctx })

  return result?.total ?? record.cost.estimatedUsd
}

/** Confirm copy for an image resubmit, priced from a fresh quote of its input. */
export function imageRegenerateDescription(item: ImageGridItem): string {
  const { input } = item.source
  const price = imageQuoteUsd(item.source)

  return `Regenerate ${imageCountText(input.count)} for ~${formatUsd(price)}?`
}

/** Confirm copy for a video resubmit, priced from a fresh quote of its input. */
export function videoRegenerateDescription(record: GenerationRecord): string {
  const price = videoQuoteUsd(record)

  return `Regenerate this video for ~${formatUsd(price)}?`
}
