import { perSecondPricing } from '../helpers'
import type { ModelPreset } from '../types'

const REFERENCES = {
  image: 10,
  video: 5,
  audio: 5,
  videoTotalSec: 15,
  audioTotalSec: 15,
  videoMinSec: 1,
  videoMaxSec: 15,
  audioMinSec: 1,
  audioMaxSec: 15,
} as const

const LIMITS = {
  image: {
    minSidePx: 240,
    maxSidePx: 8000,
    maxAspect: 8,
    maxBytes: 20 * 1024 * 1024,
    alpha: false,
  },
  video: {
    formats: ['mp4', 'mov'],
    minSidePx: 240,
    maxSidePx: 4096,
    maxAspect: 8,
    maxBytes: 100 * 1024 * 1024,
  },
  audio: { formats: ['wav', 'mp3'], maxBytes: 15 * 1024 * 1024 },
} as const

/** Shared Wan settings. A model file adds identity and pricing only. */
const WAN_FAMILY = {
  family: 'wan',
  icon: 'sparkles',
  errors: [],
  // Any integer 2-30. With a video input, input plus output must stay within 30 s.
  // Source: https://www.alibabacloud.com/help/en/model-studio/wan3-video-generation-api-reference
  // OpenRouter supported_durations lists every integer in the range. Options are quick picks.
  duration: { min: 2, max: 30, default: 5, options: [5, 10, 15, 20, 30] },
  minBillableSec: 5,
  aspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16'],
  defaultAspectRatio: '16:9',
  autoAspectWithFrames: true,
  promptOptional: false,
  resolutions: ['480p', '720p', '1080p'],
  defaultResolution: '1080p',
  audio: { supported: true, default: true },
  frames: { start: true, end: true },
  references: REFERENCES,
  referenceLimits: LIMITS,
  inputTransport: { image: 'base64', video: 'url', audio: 'url' },
  maxInputPlusOutputSec: 30,
  promptMaxChars: 20000,
  seed: true,
  refLabel: '{Kind} {n}',
} as const satisfies Partial<ModelPreset>

interface WanPresetParams {
  id: string
  title: string
  slug: string
  fallback: Record<string, number>
}

export function wanPreset(params: WanPresetParams): ModelPreset {
  const { id, title, slug, fallback } = params

  return {
    ...WAN_FAMILY,
    id,
    title,
    slug,
    // Alibaba bills input plus output seconds when a video reference is sent,
    // both at the output-resolution rate.
    // Source: https://www.alibabacloud.com/help/en/model-studio/wan3-video-generation-api-reference
    // Real-key check 2026-10-23: 5 s 480p output plus a 2 s reference gave
    // estimate 0.2975 and actual usage.cost 0.2975. Factor stays 1.
    pricing: perSecondPricing(fallback, { referenceVideoFactor: 1 }),
  }
}
