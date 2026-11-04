/* eslint-disable max-lines -- output adapters share one item shape */
import { isNil } from 'lodash-es'

import { IMAGE_COUNT_MAX, POSTER_WIDTHS, PREVIEW_WIDTH, THUMB_WIDTH } from '@/core/constants'
import type { GridItem, GridItemStatus } from '@/core/feed/grid-item'
import { videoRecordAspect } from '@/core/media/aspect'
import { aspectSize, parseAspect } from '@/core/media/geometry'
import type { MediaKindCounts } from '@/core/media/media-types'
import { canonicalizePrompt, referenceSlots, type RefSlot } from '@/core/prompt-tokens'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import type {
  ImageOutput,
  ImageOutputStatus,
  ImageRecord,
  ImageRecordStatus,
} from '@/core/schemas/image-record'
import { TERMINAL_STATUSES } from '@/core/types'
import { downloadMediaUrl, mediaUrl, thumbUrl } from '@/lib/api/media-urls'

export interface VideoGridItem extends GridItem {
  recordKind: 'video'
  source: GenerationRecord
}

export interface ImageGridItem extends GridItem {
  recordKind: 'image'
  source: ImageRecord
  output: ImageOutput | null
  costUsd: number
}

/** One view item plus the record it came from, so actions keep their data. */
export type HistoryItem = VideoGridItem | ImageGridItem

/** Accessible checkbox name: model plus the first 40 prompt characters. */
export function selectionLabel(item: HistoryItem): string {
  return `Select ${item.modelTitle} ${item.prompt.slice(0, 40)}`.trim()
}

/** Only terminal records can be selected, active work cannot be acted on. */
function isSelectable(record: GenerationRecord): boolean {
  return TERMINAL_STATUSES.includes(record.status)
}

const isTerminalImageRecord = (status: ImageRecordStatus): boolean => {
  return status !== 'submitting' && status !== 'saving'
}

/** Saved and failed outputs are selectable, pending ones stay locked. */
const isSelectableOutput = (status: ImageOutputStatus): boolean => {
  return status !== 'pending'
}

export function isVideoItem(item: HistoryItem): item is VideoGridItem {
  return item.recordKind === 'video'
}

export function isImageItem(item: HistoryItem): item is ImageGridItem {
  return item.recordKind === 'image'
}

/** Thumbnail URL for a ref, matching the API route. */
function thumbSrc(ref: string, width = THUMB_WIDTH): string {
  return thumbUrl({ ref, w: width })
}

const imageMediaSrc = (ref: string): string => {
  return mediaUrl(ref)
}

/** Download URL for a stored video file. */
function videoSrc(record: GenerationRecord): string {
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

  if (isNil(preview) || preview === '') {
    return undefined
  }

  return thumbSrc(`downloads/${preview}`, posterWidth(widthPx))
}

/** Device-pixel thumb width rounded up to the next 80 px bucket. */
function thumbWidthFor(mediaWidth: number, devicePixelRatio: number): number | undefined {
  if (mediaWidth <= 0) {
    return undefined
  }

  return Math.ceil((mediaWidth * Math.max(devicePixelRatio, 1)) / 80) * 80
}

interface PosterForWidthParams {
  record: GenerationRecord
  mediaWidth: number
  devicePixelRatio: number
}

/** Poster sized for the rendered media width in device pixels. */
export function posterForWidth(params: PosterForWidthParams): string | undefined {
  const { record, mediaWidth, devicePixelRatio } = params

  return posterSrc(record, thumbWidthFor(mediaWidth, devicePixelRatio))
}

export interface RecordSlots {
  counts: MediaKindCounts
  slots: Map<string, RefSlot>
}

/** Reference counts and slot positions from the record snapshot order. */
export function recordSlots(record: GenerationRecord): RecordSlots {
  return referenceSlots(record.input.references, (id) => {
    return record.inputsSnapshot[id]?.kind
  })
}

/** Reference counts and slot positions for an image record, whose refs are images. */
export function imageRecordSlots(record: ImageRecord): RecordSlots {
  const snapshot = record.inputsSnapshot ?? {}

  return referenceSlots(record.input.references, (id) => {
    return snapshot[id]?.kind ?? 'image'
  })
}

/** Reference counts by kind for a record prompt. */
function recordCounts(record: GenerationRecord): MediaKindCounts {
  return recordSlots(record).counts
}

/** Stored prompt canonicalized to positional slots. */
export function canonicalPrompt(record: GenerationRecord): string {
  return canonicalizePrompt(record.input.prompt, recordCounts(record))
}

const terminalStatus = (status: ImageRecordStatus): GridItemStatus => {
  if (status === 'submitting' || status === 'saving') {
    return status
  }

  if (status === 'cancelled') {
    return 'cancelled'
  }

  if (status === 'failed' || status === 'partial') {
    return 'failed'
  }

  return 'completed'
}

/** Images sharing one record cost: saved outputs, else the planned count. */
export function imageShareCount(record: ImageRecord): number {
  const saved = record.outputs.filter((output) => {
    return output.status === 'saved'
  }).length

  if (saved > 0) {
    return saved
  }

  return Math.max(1, record.input.count)
}

const costOf = (record: ImageRecord): number => {
  const total = record.cost.actualUsd ?? record.cost.estimatedUsd

  return total / imageShareCount(record)
}

function outputImageItem(record: ImageRecord, output: ImageOutput): ImageGridItem {
  const base = {
    id: output.id,
    recordId: record.id,
    recordKind: 'image' as const,
    createdAt: record.createdAt,
    modelTitle: record.preset.title,
    prompt: record.input.prompt,
    costUsd: costOf(record),
    canSelect: isSelectableOutput(output.status),
    source: record,
    output,
  }

  if (output.status === 'pending') {
    const size = aspectSize(record.input.aspectRatio)

    return {
      ...base,
      status: terminalStatus(record.status),
      favorite: false,
      width: size.width,
      height: size.height,
      thumbSrc: '',
      mediaSrc: '',
    }
  }

  if (output.status === 'failed') {
    return {
      ...base,
      status: 'failed',
      favorite: false,
      width: null,
      height: null,
      thumbSrc: '',
      mediaSrc: '',
    }
  }

  const ref = `images/${output.file}`

  return {
    ...base,
    status: 'completed',
    favorite: output.favorite,
    width: output.width,
    height: output.height,
    thumbSrc: thumbSrc(ref),
    mediaSrc: imageMediaSrc(ref),
  }
}

function placeholderItem(record: ImageRecord, index: number): ImageGridItem {
  const size = aspectSize(record.input.aspectRatio)

  return {
    id: `${record.id}:${index}`,
    recordId: record.id,
    recordKind: 'image',
    status: terminalStatus(record.status),
    createdAt: record.createdAt,
    favorite: false,
    width: size.width,
    height: size.height,
    thumbSrc: '',
    mediaSrc: '',
    modelTitle: record.preset.title,
    prompt: record.input.prompt,
    costUsd: costOf(record),
    canSelect: isTerminalImageRecord(record.status),
    source: record,
    output: null,
  }
}

/** Video record to one tile. */
export function videoItem(record: GenerationRecord): VideoGridItem {
  return {
    id: record.id,
    recordId: record.id,
    recordKind: 'video',
    status: record.status,
    createdAt: record.createdAt,
    favorite: record.favorite,
    width: record.output?.width ?? null,
    height: record.output?.height ?? null,
    thumbSrc: posterSrc(record) ?? '',
    mediaSrc: videoSrc(record),
    modelTitle: record.preset.title,
    prompt: canonicalPrompt(record),
    costUsd: record.cost.actualUsd ?? record.cost.estimatedUsd,
    canSelect: isSelectable(record),
    source: record,
  }
}

interface ImageThumbForWidthParams {
  item: ImageGridItem
  mediaWidth: number
  devicePixelRatio: number
}

/** Image thumb sized for the rendered media width in device pixels. */
export function imageThumbForWidth(params: ImageThumbForWidthParams): string {
  const { item, mediaWidth, devicePixelRatio } = params
  const width = thumbWidthFor(mediaWidth, devicePixelRatio)

  if (isNil(width) || item.output?.status !== 'saved') {
    return item.thumbSrc
  }

  return thumbSrc(`images/${item.output.file}`, width)
}

interface ImageItemsCache {
  all?: ImageGridItem[]
  favorite?: ImageGridItem[]
}

const imageItemsCache = new WeakMap<ImageRecord, ImageItemsCache>()

/** Image record to one tile per output, with legacy count placeholders when none exist. */
export function imageItems(record: ImageRecord, isFavoriteOnly = false): ImageGridItem[] {
  const cache = imageItemsCache.get(record) ?? {}
  const cached = isFavoriteOnly ? cache.favorite : cache.all

  if (!isNil(cached)) {
    return cached
  }

  const items = buildImageItems(record, isFavoriteOnly)

  if (isFavoriteOnly) {
    cache.favorite = items
  } else {
    cache.all = items
  }

  imageItemsCache.set(record, cache)

  return items
}

function buildImageItems(record: ImageRecord, isFavoriteOnly: boolean): ImageGridItem[] {
  if (isFavoriteOnly) {
    return record.outputs
      .filter((output) => {
        return output.status === 'saved' && output.favorite
      })
      .map((output) => {
        return outputImageItem(record, output)
      })
  }

  if (record.outputs.length > 0) {
    return record.outputs.map((output) => {
      return outputImageItem(record, output)
    })
  }

  const count = Math.max(1, Math.min(record.input.count, IMAGE_COUNT_MAX))
  const isPending = record.status === 'submitting' || record.status === 'saving'

  if (!isPending) {
    return [placeholderItem(record, 0)]
  }

  return Array.from({ length: count }, (_, index) => {
    return placeholderItem(record, index)
  })
}

/** Masonry aspect from output pixels, else the record ratio, else square for images. */
export function itemAspect(item: HistoryItem): number {
  if (!isNil(item.width) && !isNil(item.height) && item.width > 0 && item.height > 0) {
    return item.width / item.height
  }

  if (!isVideoItem(item)) {
    return 1
  }

  const sides = parseAspect(videoRecordAspect(item.source))

  if (isNil(sides)) {
    return 16 / 9
  }

  return sides[0] / sides[1]
}
