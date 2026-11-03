import type { ReferenceLimits } from '../../common/reference-limits'
import type { VideoFamily, VideoPreset } from '../types'
import { SEEDANCE_ERRORS } from './errors'

const SEEDANCE_FAMILY_ID: VideoFamily = 'seedance'

/** Shared Seedance settings. A model file adds durations, sizes and pricing. */
export const SEEDANCE_FAMILY = {
  family: SEEDANCE_FAMILY_ID,
  icon: 'audio-lines',
  autoAspectWithFrames: true,
  promptOptional: false,
  audio: { supported: true, default: true },
  frames: { start: true, end: true },
  maxInputPlusOutputSec: null,
  promptMaxChars: 5000,
  seed: true,
  errors: SEEDANCE_ERRORS,
} as const satisfies Partial<VideoPreset>

export const seedanceImageLimits = (formats: readonly string[]): ReferenceLimits => {
  return {
    formats,
    minSidePx: 300,
    maxSidePx: 6000,
    maxAspect: 2.5,
    maxBytes: 30 * 1024 * 1024,
    // Undocumented. Keep false until a transparent PNG passes a real request.
    alpha: false,
  }
}

/** No documented video or audio limits. Provider errors gate them for now. */
export const SEEDANCE_UNKNOWN_LIMITS = { video: {}, audio: {} } as const
