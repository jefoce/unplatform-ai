import { imagePricing, imageResolutionOptions } from '../../common/options'
import type { ImagePreset } from '../types'
import { SEEDREAM_FAMILY } from './family'

export const SEEDREAM_5_LITE: ImagePreset = {
  ...SEEDREAM_FAMILY,
  id: 'seedream-5-0-lite',
  title: 'Seedream 5 Lite',
  description: 'ByteDance image model at 2K or 4K, up to 4 images per call.',
  resolutions: imageResolutionOptions(['2K', '4K']),
  defaultResolution: '2K',
  maxN: 4,
  referenceMax: 14,
  bindings: [
    {
      provider: 'openrouter',
      modelId: 'bytedance-seed/seedream-5-0-lite',
      // $0.035 per image at every supported resolution. Reference images are
      // free (input_image 0), so no input line is stored.
      // Source: https://openrouter.ai/bytedance-seed/seedream-5-0-lite (read
      // 2026-10-30) and live /api/v1/images/models and /endpoints.
      pricing: imagePricing({
        skuRules: [{ when: {}, key: 'output_image_base_image' }],
        fallback: { output_image_base_image: 0.035 },
      }),
    },
  ],
}
