import { find, isNil } from 'lodash-es'

import { imageResolutionDisplay } from '@/core/presets/common/display'
import { findImagePreset } from '@/core/presets/image'
import type { ImageAspectChoice, ImageOption, ImagePreset } from '@/core/presets/image/types'
import { formatEstimate, formatUsd } from '@/core/pricing/format'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import {
  type ImageGenerationInput,
  type ImageRecord,
  isImageActive,
} from '@/core/schemas/image-record'
import { ACTIVE_STATUSES } from '@/core/types'
import { type ImageGridItem, imageShareCount } from '@/lib/feed/output-items'
import { formatClock } from '@/lib/format'

export interface CostInfo {
  text: string
  note: string
}

/** Cost text and its estimate or rate note for one record. */
export function costInfo(record: GenerationRecord): CostInfo {
  if (ACTIVE_STATUSES.includes(record.status)) {
    return { text: formatEstimate(record.cost.estimatedUsd), note: '' }
  }

  // Cancelled before submit is the only true zero at the job level.
  if (record.status === 'cancelled') {
    return { text: 'Not billed', note: '' }
  }

  if (isNil(record.cost.actualUsd)) {
    return { text: formatEstimate(record.cost.estimatedUsd), note: 'Cost not reported' }
  }

  if (record.status !== 'completed') {
    return { text: formatUsd(record.cost.actualUsd), note: '' }
  }

  const note = `${formatEstimate(record.cost.estimatedUsd)} / ${formatUsd(record.cost.pricePerSec)}/s`

  return { text: formatUsd(record.cost.actualUsd), note }
}

/** Appends the charge warning when an uncertain call may have billed. */
function chargeNote(record: ImageRecord, note: string): string {
  if (record.cost.mayHaveBeenCharged !== true) {
    return note
  }

  if (note === '') {
    return 'May have been charged'
  }

  return `${note}. May have been charged`
}

/** Actual cost text when reported, null when the provider did not report one. */
function reportedImageCost(item: ImageGridItem, suffix: string): CostInfo | null {
  const actual = item.source.cost.actualUsd

  if (isNil(actual) || !Number.isFinite(actual)) {
    return null
  }

  if (actual === 0) {
    return { text: 'Not billed', note: '' }
  }

  return { text: `${formatUsd(item.costUsd)}${suffix}`, note: chargeNote(item.source, '') }
}

/** Cost text for one image share, following the video rule. */
export function imageCostInfo(item: ImageGridItem): CostInfo {
  const record = item.source
  const count = imageShareCount(record)
  const suffix = count > 1 ? ' each' : ''
  const estimate = `${formatEstimate(item.costUsd)}${suffix}`

  if (isImageActive(record)) {
    return { text: estimate, note: chargeNote(record, '') }
  }

  if (record.status !== 'completed' && record.status !== 'partial') {
    const reported = reportedImageCost(item, suffix)

    if (!isNil(reported)) {
      return reported
    }

    if (record.cost.mayHaveBeenCharged === true) {
      return { text: estimate, note: chargeNote(record, 'Cost not reported') }
    }

    return { text: 'Not billed', note: '' }
  }

  if (isNil(record.cost.actualUsd)) {
    return { text: estimate, note: chargeNote(record, 'Cost not reported') }
  }

  return { text: `${formatUsd(item.costUsd)}${suffix}`, note: chargeNote(record, '') }
}

/** Wall time createdAt to the final timestamp or the live clock, as m:ss. */
export function totalTime(record: GenerationRecord, now?: number): string {
  const end = now ?? new Date(record.job?.completedAt ?? record.updatedAt).getTime()

  return formatClock((end - new Date(record.createdAt).getTime()) / 1000)
}

function optionLabel<T extends string>(
  options: readonly ImageOption<T>[] | null,
  value: T | null,
): string | null {
  if (isNil(options) || isNil(value)) {
    return null
  }

  const match = find(options, (option) => {
    return option.value === value
  })

  return match?.label ?? null
}

function aspectLabel(value: ImageAspectChoice): string {
  if (value === 'auto') {
    return 'Auto'
  }

  return value
}

function aspectSetting(preset: ImagePreset, input: ImageGenerationInput): string | null {
  if (!preset.aspectRatios.includes(input.aspectRatio)) {
    return null
  }

  return aspectLabel(input.aspectRatio)
}

export interface ImageSettingChip {
  kind: 'resolution' | 'quality' | 'background' | 'aspect'
  label: string
}

/** Chips for the controls the record preset actually supports, in display order. */
export function imageSettingChips(input: ImageGenerationInput): ImageSettingChip[] {
  const preset = findImagePreset(input.presetId)

  if (isNil(preset)) {
    return []
  }

  const chips: ImageSettingChip[] = []

  if (!isNil(input.resolution)) {
    const label = imageResolutionDisplay(preset, {
      resolution: input.resolution,
      aspect: input.aspectRatio,
    }).label

    chips.push({ kind: 'resolution', label })
  }

  const quality = optionLabel(preset.qualities, input.quality)

  if (!isNil(quality)) {
    chips.push({ kind: 'quality', label: quality })
  }

  const background = optionLabel(preset.backgrounds, input.background)

  if (!isNil(background)) {
    chips.push({ kind: 'background', label: background })
  }

  const aspect = aspectSetting(preset, input)

  if (!isNil(aspect)) {
    chips.push({ kind: 'aspect', label: aspect })
  }

  return chips
}

/** Seed of a saved image output, null otherwise. */
export function imageOutputSeed(item: ImageGridItem): number | null {
  if (item.output?.status !== 'saved') {
    return null
  }

  return item.output.seed
}
