import { imagePricing, imageResolutionOptions } from '../../common/options'
import type { ImagePreset } from '../types'
import { FLUX_FAMILY } from './family'

export const FLUX_3_KLEIN: ImagePreset = {
  ...FLUX_FAMILY,
  id: 'flux-3-image-klein',
  title: 'FLUX 3 Klein',
  description: 'Black Forest Labs image model from 768 to 4K with up to 10 references.',
  resolutions: imageResolutionOptions(['768', '1K', '1.5K', '2K', '4K']),
  defaultResolution: '1K',
  bindings: [
    {
      provider: 'openrouter',
      modelId: 'black-forest-labs/flux-3-image-klein',
      // $0.008 at 768, $0.009 at 1K, $0.011 at 1.5K, $0.014 at 2K, $0.036 at
      // 4K. Source: live /api/v1/images/models and /endpoints, 2026-10-29.
      pricing: imagePricing({
        skuRules: [
          { when: { resolution: '768' }, key: 'output_image_768_image' },
          { when: { resolution: '1K' }, key: 'output_image_1k_image' },
          { when: { resolution: '1.5K' }, key: 'output_image_1.5k_image' },
          { when: { resolution: '2K' }, key: 'output_image_2k_image' },
          { when: { resolution: '4K' }, key: 'output_image_4k_image' },
        ],
        fallback: {
          output_image_768_image: 0.008,
          output_image_1k_image: 0.009,
          'output_image_1.5k_image': 0.011,
          output_image_2k_image: 0.014,
          output_image_4k_image: 0.036,
        },
      }),
    },
  ],
}
