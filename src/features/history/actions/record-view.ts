import { isNil } from 'lodash-es'

import { POSTER_WIDTHS, PREVIEW_WIDTH } from '@/core/constants'
import { isNonEmptyString } from '@/core/guards'
import type { MediaKindCounts } from '@/core/media-types'
import { findPreset } from '@/core/presets'
import { canonicalizePrompt, referenceSlots, type RefSlot } from '@/core/prompt-tokens'
import { friendlyError } from '@/core/provider-errors'
import type { FriendlyError } from '@/core/provider-errors/types'
import { videoProviderDescriptor } from '@/core/providers/registry'
import type { GenerationRecord, JobStatus } from '@/core/schemas/generation-record'
import { downloadMediaUrl, thumbUrl, uploadThumbUrl } from '@/lib/api/media-urls'

const SELECTABLE_STATUSES: readonly JobStatus[] = ['completed', 'failed', 'cancelled', 'expired']

/** Only terminal records can be selected, active work cannot be acted on. */
export function isSelectable(record: GenerationRecord): boolean {
  return SELECTABLE_STATUSES.includes(record.status)
}

/** Friendly error for a record, or null when there is no raw text. */
export function recordError(record: GenerationRecord): FriendlyError | null {
  if (!isNonEmptyString(record.error)) {
    return null
  }

  return friendlyError({
    raw: record.error,
    family: findPreset(record.input.presetId)?.family ?? null,
    httpRules: videoProviderDescriptor(record.provider).httpRules,
  })
}

const hasPx = (value: number | undefined): boolean => {
  return !isNil(value) && value !== 0 && !Number.isNaN(value)
}

const sizedAspect = (width: number | undefined, height: number | undefined): string | undefined => {
  if (!hasPx(width) || !hasPx(height)) {
    return undefined
  }

  return `${width}/${height}`
}

/** Aspect truth: output size, then start frame size, then selected ratio. */
export function recordAspect(record: GenerationRecord): string {
  const output = record.output
  const start = record.input.frames.start
  const isFrame = isNil(start)

  const frame = isFrame ? undefined : record.inputsSnapshot[start]
  const aspect = record.input.aspectRatio

  const sized =
    sizedAspect(output?.width, output?.height) ?? sizedAspect(frame?.width, frame?.height)

  if (!isNil(sized)) {
    return sized
  }

  if (aspect === 'auto') {
    return '16/9'
  }

  return aspect.replace(':', '/')
}

export const videoSrc = (record: GenerationRecord): string => {
  return downloadMediaUrl(record.output?.video ?? `${record.id}.mp4`)
}

/** Rounds up to the next poster bucket. */
function posterWidth(widthPx: number): number {
  return (
    POSTER_WIDTHS.find((width) => {
      return width >= widthPx
    }) ?? Math.max(...POSTER_WIDTHS)
  )
}

/** Poster thumb rounded up to a fixed bucket, defaults to the preview width. */
export function posterSrc(record: GenerationRecord, widthPx = PREVIEW_WIDTH): string | undefined {
  const preview = record.output?.preview

  if (!isNonEmptyString(preview)) {
    return undefined
  }

  return thumbUrl({ ref: `downloads/${preview}`, w: posterWidth(widthPx) })
}

/** Poster sized for the rendered media width in device pixels. */
export function posterForWidth(record: GenerationRecord, mediaWidth: number): string | undefined {
  const dprValue = typeof window === 'undefined' ? 1 : window.devicePixelRatio
  const dpr = Math.max(dprValue, 1)
  const width = mediaWidth > 0 ? Math.ceil((mediaWidth * dpr) / 80) * 80 : undefined

  return posterSrc(record, width)
}

export const uploadThumb = (id: string, width = 160): string => {
  return uploadThumbUrl(id, width)
}

interface RecordSlots {
  counts: MediaKindCounts
  slots: Map<string, RefSlot>
}

/** Reference counts and slot positions from the record snapshot order. */
export function recordSlots(record: GenerationRecord): RecordSlots {
  return referenceSlots(record.input.references, (id) => {
    return record.inputsSnapshot[id]?.kind
  })
}

/** Reference counts by kind for a record prompt. */
export function recordCounts(record: GenerationRecord): MediaKindCounts {
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
