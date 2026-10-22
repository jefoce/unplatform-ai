import { videoTokenPricing } from '../helpers'
import type { ModelPreset } from '../types'
import { SEEDANCE_FAMILY, SEEDANCE_UNKNOWN_LIMITS, seedanceImageLimits } from './family'

const SIZES = {
  '480p': {
    '16:9': '854x480',
    '4:3': '752x560',
    '1:1': '640x640',
    '3:4': '560x752',
    '9:16': '480x854',
    '21:9': '992x432',
  },
  '720p': {
    '16:9': '1280x720',
    '4:3': '1112x834',
    '1:1': '960x960',
    '3:4': '834x1112',
    '9:16': '720x1280',
    '21:9': '1470x630',
  },
} as const

const PRICING = videoTokenPricing({
  key: ({ audio: hasAudio, hasVideoInput: hasVideo }) => {
    if (hasVideo) return 'video_tokens_with_video_input'

    return hasAudio ? 'video_tokens' : 'video_tokens_without_audio'
  },
  fallback: {
    video_tokens: 0.0000107,
    video_tokens_without_audio: 0.0000107,
    video_tokens_with_video_input: 0.0000064,
  },
  // Token count uses input plus output seconds. video_tokens_with_video_input is a
  // lower per-token rate, not a replacement for the input tokens, so the factor stays 1.
  // Unverified with a real key. Source: https://docs.byteplus.com/en/docs/byteplus_las/video_gen_enhanced
  referenceVideoFactor: 1,
})

export const SEEDANCE_25: ModelPreset = {
  ...SEEDANCE_FAMILY,
  id: 'seedance-2.5',
  title: 'Seedance 2.5',
  slug: 'bytedance/seedance-2.5',
  // Any integer 4-30. Source: https://docs.byteplus.com/en/docs/byteplus_las/video_gen_enhanced
  // OpenRouter supported_durations lists every integer in the range. Options are quick picks.
  duration: { min: 4, max: 30, default: 5, options: [4, 5, 8, 10, 15, 20, 30] },
  aspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
  defaultAspectRatio: '16:9',
  resolutions: ['480p', '720p'],
  defaultResolution: '720p',
  references: {
    image: 30,
    video: 10,
    audio: 10,
    videoTotalSec: 30,
    audioTotalSec: 30,
    videoMinSec: 2,
    audioMinSec: 2,
    audioNeedsVisual: true,
  },
  referenceLimits: {
    image: seedanceImageLimits([
      'jpg',
      'jpeg',
      'png',
      'webp',
      'bmp',
      'tif',
      'tiff',
      'gif',
      'heic',
      'heif',
    ]),
    ...SEEDANCE_UNKNOWN_LIMITS,
  },
  maxInputPlusOutputSec: null,
  refLabel: '@{Kind} {n}',
  outputSizes: SIZES,
  pricing: PRICING,
}
