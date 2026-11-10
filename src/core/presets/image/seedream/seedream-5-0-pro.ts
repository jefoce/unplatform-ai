import { imagePricing, imageResolutionOptions } from '../../common/options'
import type { ImagePreset } from '../types'
import { SEEDREAM_FAMILY } from './family'

export const SEEDREAM_5_PRO: ImagePreset = {
  ...SEEDREAM_FAMILY,
  id: 'seedream-5-0-pro',
  title: 'Seedream 5 Pro',
  description: 'ByteDance image model at 1K or 2K with up to 14 references.',
  resolutions: imageResolutionOptions(['1K', '2K']),
  defaultResolution: '1K',
  maxN: 1,
  referenceMax: 14,
  bindings: [
    {
      provider: 'openrouter',
      modelId: 'bytedance-seed/seedream-5-0-pro',
      // $0.045 at 1K and $0.09 for the high-resolution 2K variant.
      // $0.003 per reference image.
      // Source: https://openrouter.ai/bytedance-seed/seedream-5-0-pro and
      // /api/v1/images/models/bytedance-seed/seedream-5-0-pro/endpoints,
      // read 2026-10-30.
      pricing: imagePricing({
        skuRules: [
          { when: { resolution: '2K' }, key: 'output_image_high_resolution_image' },
          { when: {}, key: 'output_image_base_image' },
        ],
        fallback: {
          output_image_base_image: 0.045,
          output_image_high_resolution_image: 0.09,
          input_image_base_image: 0.003,
        },
      }),
    },
  ],
}
