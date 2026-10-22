import { wanPreset } from './family'

export const WAN_30 = wanPreset({
  id: 'wan-3.0',
  title: 'Wan 3.0',
  slug: 'alibaba/wan-3.0',
  fallback: {
    duration_seconds_480p: 0.05,
    duration_seconds_720p: 0.1,
    duration_seconds_1080p: 0.2,
  },
})
