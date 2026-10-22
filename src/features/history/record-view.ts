import { isNil } from 'lodash-es'

import { POSTER_WIDTHS, PREVIEW_WIDTH } from '@/core/constants'
import { findPreset } from '@/core/presets'
import {
  canonicalizePrompt,
  referenceSlots,
  type RefSlot,
  type SlotCounts,
} from '@/core/prompt-tokens'
import { type FriendlyError, friendlyError } from '@/core/provider-errors'
import type { GenerationRecord } from '@/core/types'
import { thumbUrl } from '@/features/media-picker/api'

const SELECTABLE_STATUSES: readonly GenerationRecord['status'][] = [
  'completed',
  'failed',
  'cancelled',
  'expired',
]

/** Only terminal records can be selected, active work cannot be acted on. */
export function isSelectable(record: GenerationRecord): boolean {
  return SELECTABLE_STATUSES.includes(record.status)
}

/** Friendly error for a record, or null when there is no raw text. */
export function recordError(record: GenerationRecord): FriendlyError | null {
  if (isNil(record.error) || record.error === '') return null
  return friendlyError({
    raw: record.error,
    family: findPreset(record.input.presetId)?.family ?? null,
  })
}

const hasPx = (value: number | undefined): boolean =>
  !isNil(value) && value !== 0 && !Number.isNaN(value)

const sizedAspect = (width: number | undefined, height: number | undefined): string | undefined => {
  if (!hasPx(width) || !hasPx(height)) return undefined

  return `${width}/${height}`
}

/** Aspect truth: output size, then start frame size, then selected ratio. */
export function recordAspect(record: GenerationRecord): string {
  const output = record.output
  const start = record.input.frames.start
  const frame = isNil(start) ? undefined : record.inputsSnapshot[start]
  const aspect = record.input.aspectRatio
  const sized =
    sizedAspect(output?.width, output?.height) ?? sizedAspect(frame?.width, frame?.height)

  if (!isNil(sized)) return sized
  if (aspect === 'auto') return '16/9'
  return aspect.replace(':', '/')
}

export const videoSrc = (record: GenerationRecord): string =>
  `/api/media/downloads/${record.output?.video ?? `${record.id}.mp4`}`

/** Rounds up to the next poster bucket. */
function posterWidth(widthPx: number): number {
  return POSTER_WIDTHS.find((width) => width >= widthPx) ?? Math.max(...POSTER_WIDTHS)
}

/** Poster thumb rounded up to a fixed bucket, defaults to the preview width. */
export function posterSrc(record: GenerationRecord, widthPx = PREVIEW_WIDTH): string | undefined {
  const preview = record.output?.preview

  if (isNil(preview) || preview === '') return undefined

  return thumbUrl({ ref: `downloads/${preview}`, w: posterWidth(widthPx) })
}

export const uploadThumb = (id: string, width = 160): string =>
  `/api/thumbs/uploads/${id}?w=${width}`

/** Reference counts and slot positions from the record snapshot order. */
export function recordSlots(record: GenerationRecord): {
  counts: SlotCounts
  slots: Map<string, RefSlot>
} {
  return referenceSlots(record.input.references, (id) => record.inputsSnapshot[id]?.kind)
}

/** Reference counts by kind for a record prompt. */
export function recordCounts(record: GenerationRecord): SlotCounts {
  return recordSlots(record).counts
}

/** Stored prompt canonicalized to positional slots. */
export function canonicalPrompt(record: GenerationRecord): string {
  return canonicalizePrompt(record.input.prompt, recordCounts(record))
}

/** Prompt copy text: canonical slots, no ids. */
export function plainPrompt(record: GenerationRecord): string {
  return canonicalPrompt(record)
}
