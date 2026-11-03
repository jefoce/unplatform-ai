import type { MediaKind } from '../../media/media-types'

export interface ReferenceLimits {
  maxBytes?: number
  minSidePx?: number
  maxSidePx?: number

  /** Lowercase extensions, no dot. */
  formats?: readonly string[]

  /** Long side / short side. */
  maxAspect?: number

  /** Model keeps transparency in a PNG. False means flatten before JPEG. */
  alpha?: boolean
}

export type PresetReferenceLimits = Partial<Record<MediaKind, ReferenceLimits>>

/** Presets that can be used to encode reference images. */
export interface ReferencePreset {
  referenceLimits?: PresetReferenceLimits
}
