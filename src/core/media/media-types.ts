import { FLATTEN_BACKGROUND, FLATTEN_LIGHT } from '../constants'
import type { PixelSize } from './geometry'

export const MEDIA_KINDS = ['image', 'video', 'audio'] as const

export type MediaKind = (typeof MEDIA_KINDS)[number]

export const IMAGE_FORMATS = ['jpeg', 'png'] as const

export type ImageFormat = (typeof IMAGE_FORMATS)[number]

export const FLATTEN_COLORS = [FLATTEN_BACKGROUND, FLATTEN_LIGHT] as const

export type FlattenColor = (typeof FLATTEN_COLORS)[number]

/** Count per media kind. */
export interface MediaKindCounts {
  image: number
  video: number
  audio: number
}

/** Planned encoding for the attached images. One step for the whole request. */
export interface ReferencePlan {
  step: number
  maxSide: number
  totalBytes: number
  images: ReferencePlanImage[]
}

export interface ReferencePlanImage extends PixelSize {
  id: string
  bytes: number
  format: ImageFormat
  flattened?: FlattenColor
}
