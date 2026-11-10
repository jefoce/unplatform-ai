import {
  GEMINI_RATIOS_STANDARD,
  IMAGE_PROMPT_MAX_CHARS,
  IMAGE_REFERENCE_LIMITS,
  imageResolutionOptions,
  tokenPricing,
} from '../../common/options'
import type { ImagePreset } from '../types'
import { GEMINI_3_PRO_OUTPUT_TOKEN_RULES, GEMINI_FAMILY } from './family'

export const GEMINI_3_PRO_IMAGE: ImagePreset = {
  ...GEMINI_FAMILY,
  id: 'gemini-3-pro-image',
  title: 'Nano Banana Pro',
  description: 'Gemini Pro image model with 1K to 4K output and up to 14 references.',
  aspectRatios: GEMINI_RATIOS_STANDARD,
  resolutions: imageResolutionOptions(['1K', '2K', '4K']),
  defaultResolution: '1K',
  params: [...GEMINI_FAMILY.params, 'resolution'],
  maxN: 1,
  referenceMax: 14,
  referenceLimits: IMAGE_REFERENCE_LIMITS,
  promptMaxChars: IMAGE_PROMPT_MAX_CHARS,
  bindings: [
    {
      provider: 'openrouter',
      modelId: 'google/gemini-3-pro-image',
      // $0.000002 per input token and $0.00012 per output token, live endpoints read
      // 2026-10-29. Output tokens come from the per-model Gemini table.
      pricing: tokenPricing({
        outputUsd: 0.00012,
        inputImageUsd: 0.000002,
        outputTokenRules: GEMINI_3_PRO_OUTPUT_TOKEN_RULES,
        referenceTokens: 258,
      }),
    },
  ],
}
