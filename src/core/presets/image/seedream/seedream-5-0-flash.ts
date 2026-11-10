import { imagePricing, imageResolutionOptions } from '../../common/options'
import type { ImagePreset } from '../types'
import { SEEDREAM_FAMILY } from './family'

export const SEEDREAM_5_FLASH: ImagePreset = {
  ...SEEDREAM_FAMILY,
  id: 'seedream-5-0-flash',
  title: 'Seedream 5 Flash',
  description: 'ByteDance image model at 1K or 2K with up to 14 references.',
  resolutions: imageResolutionOptions(['1K', '2K']),
  defaultResolution: '1K',
  maxN: 1,
  referenceMax: 14,
  bindings: [
    {
      provider: 'openrouter',
      modelId: 'bytedance-seed/seedream-5-0-flash',
      // $0.018 per image at every supported resolution. Reference images are
      // free (input_image 0), so no input line is stored.
      // Source: https://openrouter.ai/bytedance-seed/seedream-5-0-flash (read
      // 2026-10-30) and live /api/v1/images/models and /endpoints.
      pricing: imagePricing({
        skuRules: [{ when: {}, key: 'output_image_base_image' }],
        fallback: { output_image_base_image: 0.018 },
      }),
    },
  ],
}
