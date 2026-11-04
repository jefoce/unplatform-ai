import { IMAGE_REFERENCE_MAX } from '@/core/constants'
import { DEFAULT_IMAGE_PRESET_ID, findImagePreset, IMAGE_PRESETS } from '@/core/presets/image'
import type { ImagePreset } from '@/core/presets/image/types'

/** Preset for a stored id, falling back to the default for display only. */
export function currentImagePreset(id: string): ImagePreset {
  return findImagePreset(id) ?? findImagePreset(DEFAULT_IMAGE_PRESET_ID) ?? IMAGE_PRESETS[0]
}

/** Native reference cap shared with the submit schema. */
export function imageReferenceMax(preset: ImagePreset): number {
  return Math.min(preset.referenceMax, IMAGE_REFERENCE_MAX)
}
