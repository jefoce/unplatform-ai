import { wanPreset } from './family'

// Prime shares the Wan 3.0 schema and its duration rules.
// Reference-video billing is unverified with a real key and assumes the Wan 3.0 rule:
// input plus output seconds, both at the output-resolution rate.
// Source: https://www.alibabacloud.com/help/en/model-studio/wan3-0-video-prime
export const WAN_30_PRIME = wanPreset({
  id: 'wan-3.0-prime',
  title: 'Wan 3.0 Prime',
  slug: 'alibaba/wan-3.0-prime',
  fallback: {
    duration_seconds_480p: 0.068,
    duration_seconds_720p: 0.14,
    duration_seconds_1080p: 0.28,
  },
})
