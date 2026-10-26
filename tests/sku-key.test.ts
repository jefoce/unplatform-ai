import { describe, expect, it } from 'vitest'

import { MODEL_PRESETS } from '@/core/presets'
import { primaryBinding } from '@/core/presets/bindings'
import { skuKey } from '@/core/pricing'
import type { Dict } from '@/core/utility-types'

import { required } from './helpers/required'

/** Keys recorded from the per-preset key functions before the SKU rules replaced them. */
const EXPECTED: Dict<Dict<string>> = {
  'wan-3.0': {
    '480p|true|true': 'duration_seconds_480p',
    '480p|true|false': 'duration_seconds_480p',
    '480p|false|true': 'duration_seconds_480p',
    '480p|false|false': 'duration_seconds_480p',
    '720p|true|true': 'duration_seconds_720p',
    '720p|true|false': 'duration_seconds_720p',
    '720p|false|true': 'duration_seconds_720p',
    '720p|false|false': 'duration_seconds_720p',
    '1080p|true|true': 'duration_seconds_1080p',
    '1080p|true|false': 'duration_seconds_1080p',
    '1080p|false|true': 'duration_seconds_1080p',
    '1080p|false|false': 'duration_seconds_1080p',
  },
  'wan-3.0-prime': {
    '480p|true|true': 'duration_seconds_480p',
    '480p|true|false': 'duration_seconds_480p',
    '480p|false|true': 'duration_seconds_480p',
    '480p|false|false': 'duration_seconds_480p',
    '720p|true|true': 'duration_seconds_720p',
    '720p|true|false': 'duration_seconds_720p',
    '720p|false|true': 'duration_seconds_720p',
    '720p|false|false': 'duration_seconds_720p',
    '1080p|true|true': 'duration_seconds_1080p',
    '1080p|true|false': 'duration_seconds_1080p',
    '1080p|false|true': 'duration_seconds_1080p',
    '1080p|false|false': 'duration_seconds_1080p',
  },
  'seedance-2.0': {
    '480p|true|true': 'video_tokens_with_video_input',
    '480p|true|false': 'video_tokens',
    '480p|false|true': 'video_tokens_with_video_input',
    '480p|false|false': 'video_tokens_without_audio',
    '720p|true|true': 'video_tokens_with_video_input',
    '720p|true|false': 'video_tokens',
    '720p|false|true': 'video_tokens_with_video_input',
    '720p|false|false': 'video_tokens_without_audio',
    '1080p|true|true': 'video_tokens_1080p_with_video_input',
    '1080p|true|false': 'video_tokens_1080p',
    '1080p|false|true': 'video_tokens_1080p_with_video_input',
    '1080p|false|false': 'video_tokens_1080p',
    '4K|true|true': 'video_tokens_4k_with_video_input',
    '4K|true|false': 'video_tokens_4k',
    '4K|false|true': 'video_tokens_4k_with_video_input',
    '4K|false|false': 'video_tokens_4k',
  },
  'seedance-2.5': {
    '480p|true|true': 'video_tokens_with_video_input',
    '480p|true|false': 'video_tokens',
    '480p|false|true': 'video_tokens_with_video_input',
    '480p|false|false': 'video_tokens_without_audio',
    '720p|true|true': 'video_tokens_with_video_input',
    '720p|true|false': 'video_tokens',
    '720p|false|true': 'video_tokens_with_video_input',
    '720p|false|false': 'video_tokens_without_audio',
  },
}

const COMBINATIONS = [
  [true, true],
  [true, false],
  [false, true],
  [false, false],
] as const

describe('skuKey', () => {
  it('returns the recorded key for every preset combination', () => {
    for (const preset of MODEL_PRESETS) {
      const expected = required(EXPECTED[preset.id], preset.id)

      for (const resolution of preset.resolutions) {
        for (const [isAudio, hasVideoInput] of COMBINATIONS) {
          const label = `${preset.id} ${resolution} audio=${isAudio} video=${hasVideoInput}`

          expect(
            skuKey(primaryBinding(preset).pricing, { resolution, audio: isAudio, hasVideoInput }),
            label,
          ).toBe(expected[`${resolution}|${isAudio}|${hasVideoInput}`])
        }
      }
    }
  })
})
