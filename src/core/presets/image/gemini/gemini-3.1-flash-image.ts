import { PROVIDER_IDS } from '../../../providers/types'
import {
  IMAGE_PROMPT_MAX_CHARS,
  IMAGE_REFERENCE_LIMITS,
  imageResolutionOptions,
  tokenPricing,
} from '../../common/options'
import type { ImagePreset } from '../types'
import { GEMINI_3_1_FLASH_OUTPUT_TOKEN_RULES, GEMINI_FAMILY } from './family'

export const GEMINI_31_FLASH_IMAGE: ImagePreset = {
  ...GEMINI_FAMILY,
  id: 'gemini-3.1-flash-image',
  title: 'Nano Banana 2',
  description: 'Gemini image model with 512 to 4K output and up to 14 references.',
  resolutions: imageResolutionOptions(['512', '1K', '2K', '4K']),
  defaultResolution: '1K',
  params: [...GEMINI_FAMILY.params, 'resolution'],
  maxN: 1,
  referenceMax: 14,
  referenceLimits: IMAGE_REFERENCE_LIMITS,
  promptMaxChars: IMAGE_PROMPT_MAX_CHARS,
  bindings: [
    {
      provider: PROVIDER_IDS[0],
      modelId: 'google/gemini-3.1-flash-image',
      // $0.000066 per output token, the highest endpoint rate read 2026-10-30.
      // vertex/us bills 0.000066, ai-studio and vertex/global bill 0.00006.
      // Output tokens come from the per-model Gemini table.
      pricing: tokenPricing({
        outputUsd: 0.000066,
        outputTokenRules: GEMINI_3_1_FLASH_OUTPUT_TOKEN_RULES,
        referenceTokens: 258,
      }),
    },
  ],
}
