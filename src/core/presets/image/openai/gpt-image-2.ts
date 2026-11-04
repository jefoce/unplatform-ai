import { PROVIDER_IDS } from '../../../providers/types'
import { tokenPricing } from '../../common/options'
import type { ImagePreset } from '../types'
import { GPT_IMAGE_2_OUTPUT_TOKEN_RULES, OPENAI_FAMILY, OPENAI_QUALITIES_2 } from './family'

export const GPT_IMAGE_2: ImagePreset = {
  ...OPENAI_FAMILY,
  id: 'gpt-image-2',
  title: 'GPT Image 2',
  description: 'OpenAI image model with four quality levels and up to 10 images per call.',
  qualities: OPENAI_QUALITIES_2,
  // The provider default applies, so background is not exposed or sent.
  backgrounds: null,
  defaultBackground: null,
  params: ['n', 'aspect_ratio', 'quality', 'input_references'],
  bindings: [
    {
      provider: PROVIDER_IDS[0],
      modelId: 'openai/gpt-image-2',
      // $0.00003 output, $0.000008 image input and $0.000005 text input per token,
      // live endpoints read 2026-10-29. Output tokens follow the quality table,
      // 1024 reference tokens is an estimate.
      pricing: tokenPricing({
        outputUsd: 0.00003,
        inputImageUsd: 0.000008,
        inputTextUsd: 0.000005,
        outputTokenRules: GPT_IMAGE_2_OUTPUT_TOKEN_RULES,
        referenceTokens: 1024,
      }),
    },
  ],
}
