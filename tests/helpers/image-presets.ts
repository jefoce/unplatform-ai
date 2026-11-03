import { findImagePreset } from '../../src/core/presets/image'
import type { ImagePreset } from '../../src/core/presets/image/types'

/** Preset by id, failing the test when the fixture id is not registered. */
export function imagePreset(id: string): ImagePreset {
  const preset = findImagePreset(id)

  if (preset === null) {
    throw new Error(`Unknown image preset: ${id}`)
  }

  return preset
}
