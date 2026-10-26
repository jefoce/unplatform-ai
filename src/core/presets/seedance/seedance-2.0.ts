import { VIDEO_PROVIDER_IDS } from '../../providers/types'
import { videoTokenPricing } from '../helpers'
import type { ModelPreset } from '../types'
import { SEEDANCE_FAMILY, SEEDANCE_UNKNOWN_LIMITS, seedanceImageLimits } from './family'

const SIZES = {
  '480p': {
    '16:9': '854x480',
    '4:3': '640x480',
    '1:1': '480x480',
    '3:4': '480x640',
    '9:16': '480x854',
    '21:9': '1120x480',
  },
  '720p': {
    '16:9': '1280x720',
    '4:3': '960x720',
    '1:1': '720x720',
    '3:4': '720x960',
    '9:16': '720x1280',
    '9:21': '720x1680',
    '21:9': '1680x720',
  },
  '1080p': {
    '16:9': '1920x1080',
    '4:3': '1440x1080',
    '1:1': '1080x1080',
    '3:4': '1080x1440',
    '9:16': '1080x1920',
    '21:9': '2520x1080',
  },
  '4K': {
    '16:9': '3840x2160',
    '4:3': '2880x2160',
    '1:1': '2160x2160',
    '3:4': '2160x2880',
    '9:16': '2160x3840',
    '21:9': '5040x2160',
  },
} as const

const PRICING = videoTokenPricing({
  skuRules: [
    { when: { hasVideoInput: true }, key: 'video_tokens{tier}_with_video_input' },
    { when: { hasTier: true }, key: 'video_tokens{tier}' },
    { when: { audio: true }, key: 'video_tokens' },
    { when: {}, key: 'video_tokens_without_audio' },
  ],
  tiers: { '1080p': '_1080p', '4K': '_4k' },
  fallback: {
    video_tokens: 0.000007,
    video_tokens_without_audio: 0.000007,
    video_tokens_1080p: 0.0000077,
    video_tokens_4k: 0.000004,
    video_tokens_with_video_input: 0.0000043,
    video_tokens_1080p_with_video_input: 0.0000047,
    video_tokens_4k_with_video_input: 0.0000024,
  },
  // Token count uses input plus output seconds. video_tokens_with_video_input is a
  // lower per-token rate, not a replacement for the input tokens, so the factor stays 1.
  // Source: https://docs.byteplus.com/en/docs/byteplus_las/video_gen_enhanced
  // Real-key check 2026-10-23: 4 s 480p output plus a 2 s reference gave estimate
  // 0.2479 and actual 0.3041. The gap is not explained by the input duration alone,
  // so this stays a known underestimate from an unmodeled provider token floor.
  referenceVideoFactor: 1,
})

export const SEEDANCE_20: ModelPreset = {
  ...SEEDANCE_FAMILY,
  id: 'seedance-2.0',
  title: 'Seedance 2.0',
  // Any integer 4-15. Source: https://docs.byteplus.com/en/docs/byteplus_las/video_gen_enhanced
  // OpenRouter supported_durations lists every integer in the range. Options are quick picks.
  duration: { min: 4, max: 15, default: 5, options: [4, 5, 8, 10, 15] },
  aspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', '9:21'],
  defaultAspectRatio: '16:9',
  resolutions: ['480p', '720p', '1080p', '4K'],
  defaultResolution: '720p',
  references: {
    image: 9,
    video: 3,
    audio: 3,
    videoTotalSec: 15,
    audioTotalSec: 15,
    videoMinSec: 2,
    videoMaxSec: 15,
    audioMinSec: 2,
    audioMaxSec: 15,
    audioNeedsVisual: true,
  },
  referenceLimits: {
    image: seedanceImageLimits(['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tif', 'tiff', 'gif']),
    ...SEEDANCE_UNKNOWN_LIMITS,
  },
  maxInputPlusOutputSec: null,
  refLabel: '{Kind} {n}',
  outputSizes: SIZES,
  bindings: [
    {
      provider: VIDEO_PROVIDER_IDS[0],
      modelId: 'bytedance/seedance-2.0',
      pricing: PRICING,
      transport: { image: 'base64', video: 'url', audio: 'auto' },
    },
  ],
}
