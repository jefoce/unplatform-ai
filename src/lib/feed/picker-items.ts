import { isNil } from 'lodash-es'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { ImageRecord } from '@/core/schemas/image-record'

import { type ImageGridItem, imageItems, type VideoGridItem, videoItem } from './output-items'

/** Video records to tiles, optionally only the liked ones. */
export function videoItems(records: GenerationRecord[], isFavoriteOnly = false): VideoGridItem[] {
  return records
    .filter((record) => {
      const isUsable = record.status === 'completed' && !isNil(record.output)

      return isUsable && (!isFavoriteOnly || record.favorite)
    })
    .map(videoItem)
}

/** Saved image outputs, optionally only the liked ones. */
export function savedImageItems(records: ImageRecord[], isFavoriteOnly = false): ImageGridItem[] {
  return records.flatMap((record) => {
    return imageItems(record, isFavoriteOnly).filter((item) => {
      return item.output?.status === 'saved'
    })
  })
}
