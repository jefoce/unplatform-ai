import type { ModelPreset, ReferenceLimits } from '../types'

/** Shared Seedance settings. A model file adds durations, sizes and pricing. */
export const SEEDANCE_FAMILY = {
  family: 'seedance',
  icon: 'audio-lines',
  errors: [],
  autoAspectWithFrames: true,
  promptOptional: false,
  audio: { supported: true, default: true },
  frames: { start: true, end: true },
  inputTransport: { image: 'base64', video: 'url', audio: 'auto' },
  maxInputPlusOutputSec: null,
  promptMaxChars: 5000,
  seed: true,
} as const satisfies Partial<ModelPreset>

export const seedanceImageLimits = (formats: readonly string[]): ReferenceLimits => ({
  formats,
  minSidePx: 300,
  maxSidePx: 6000,
  maxAspect: 2.5,
  maxBytes: 30 * 1024 * 1024,
  // Undocumented. Keep false until a transparent PNG passes a real request.
  alpha: false,
})

/** No documented video or audio limits. Provider errors gate them for now. */
export const SEEDANCE_UNKNOWN_LIMITS = { video: {}, audio: {} } as const
