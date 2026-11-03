import { PROVIDER_IDS } from '../../../providers/types'
import { tokenPricing } from '../../common/options'
import type { ImagePreset } from '../types'
import {
  GPT_IMAGE_25_OUTPUT_TOKEN_RULES,
  OPENAI_BACKGROUNDS_25,
  OPENAI_FAMILY,
  OPENAI_QUALITIES_25,
} from './family'

export const GPT_IMAGE_25_SUNBURST: ImagePreset = {
  ...OPENAI_FAMILY,
  id: 'gpt-image-2.5-sunburst',
  title: 'GPT Image 2.5 Sunburst',
  description: 'OpenAI image model with quality, background and up to 10 images per call.',
  qualities: OPENAI_QUALITIES_25,
  backgrounds: OPENAI_BACKGROUNDS_25,
  bindings: [
    {
      provider: PROVIDER_IDS[0],
      modelId: 'openai/gpt-image-2.5-sunburst',
      // $0.00003 output, $0.000008 image input and $0.000005 text input per token,
      // live endpoints read 2026-10-29. Output tokens follow the quality table,
      // 1024 reference tokens is an estimate.
      pricing: tokenPricing({
        outputUsd: 0.00003,
        inputImageUsd: 0.000008,
        inputTextUsd: 0.000005,
        outputTokenRules: GPT_IMAGE_25_OUTPUT_TOKEN_RULES,
        referenceTokens: 1024,
      }),
    },
  ],
}
