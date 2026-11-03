import type { JobStatus } from '../schemas/generation-record'
import type { ImageRecordStatus } from '../schemas/image-record'

export const RECORD_KINDS = ['video', 'image'] as const
export type RecordKind = (typeof RECORD_KINDS)[number]

export type GridItemStatus = JobStatus | ImageRecordStatus

/**
 * One tile. Images produce one item per output, video one per record.
 * `id` is the output id for images, the record id for video.
 */
export interface GridItem {
  id: string
  recordId: string

  recordKind: RecordKind
  status: GridItemStatus
  createdAt: string
  favorite: boolean
  width: number | null
  height: number | null
  thumbSrc: string
  mediaSrc: string
  modelTitle: string
  prompt: string
  costUsd: number | null
  canSelect: boolean
}
