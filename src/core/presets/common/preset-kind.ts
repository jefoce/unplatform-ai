import type { ImagePreset } from '../image/types'
import type { VideoPreset } from '../video/types'

/** Video presets carry a duration range, image presets do not. */
export function isVideoPreset(preset: VideoPreset | ImagePreset): preset is VideoPreset {
  return 'duration' in preset
}

export function isImagePreset(preset: VideoPreset | ImagePreset): preset is ImagePreset {
  return !isVideoPreset(preset)
}
